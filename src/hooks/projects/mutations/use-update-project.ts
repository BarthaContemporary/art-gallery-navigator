
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CreateProjectInput } from "../types/project-types";

export function useUpdateProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<CreateProjectInput> }) => {
      const { user_emails, ...projectData } = data;
      
      // Update the project
      const { error } = await supabase
        .from('projects')
        .update(projectData)
        .eq('id', id);
      
      if (error) throw error;
      
      // Update users if provided (by username)
      if (user_emails !== undefined) {
        try {
          // First delete all existing project users
          const { error: deleteError } = await supabase
            .from('project_users')
            .delete()
            .eq('project_id', id);
          
          if (deleteError) {
            console.error("Error deleting existing project users:", deleteError);
            // Continue despite the error
          }
          
          // Then add users by username
          if (user_emails.length > 0) {
            // Find users by matching their display_name with provided usernames
            const { data: foundUsers, error: userError } = await supabase
              .from('profiles')
              .select('id, display_name')
              .in('display_name', user_emails);
            
            if (userError) {
              console.error("Error finding users:", userError);
              // Log error but continue
            }
            
            // Add found users to the project one by one to avoid RLS recursion
            if (foundUsers && foundUsers.length > 0) {
              for (const user of foundUsers) {
                try {
                  const { error: insertError } = await supabase
                    .from('project_users')
                    .insert({
                      project_id: id,
                      user_id: user.id
                    });
                  
                  if (insertError) {
                    console.error("Error adding user to project:", insertError);
                  }
                } catch (err) {
                  console.error("Exception adding user to project:", err);
                }
              }
            }
            
            // Log usernames that don't match any user
            if (foundUsers) {
              const unmatchedUsernames = user_emails.filter(username => 
                !foundUsers.some(user => user.display_name === username)
              );
              
              if (unmatchedUsernames.length > 0) {
                console.log("Some users were not found:", unmatchedUsernames);
                toast.warning(`${unmatchedUsernames.length} username(s) not found.`);
              }
            }
          }
        } catch (error) {
          console.error("Error updating users by username:", error);
          // Continue with project update even if updating users fails
        }
      }
      
      return { id };
    },
    onSuccess: (_, variables) => {
      toast.success("Project updated successfully");
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', variables.id] });
    },
    onError: (error) => {
      console.error("Error updating project:", error);
      toast.error("Failed to update project");
    }
  });
}
