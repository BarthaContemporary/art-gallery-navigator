
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
      
      // Update users if provided (by email)
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
          
          // Then add users by email/username
          if (user_emails.length > 0) {
            // Find users by matching their display_name with provided emails/usernames
            const { data: foundUsers, error: userError } = await supabase
              .from('profiles')
              .select('id, display_name')
              .in('display_name', user_emails);
            
            if (userError) {
              console.error("Error finding users:", userError);
              // We'll continue and just add the users we can find
            }
            
            // Add found users to the project
            if (foundUsers && foundUsers.length > 0) {
              const projectUserPromises = foundUsers.map(async (user) => {
                const projectUser = {
                  project_id: id,
                  user_id: user.id
                };
                
                try {
                  const { error: insertError } = await supabase
                    .from('project_users')
                    .insert(projectUser);
                  
                  if (insertError) {
                    console.error("Error adding user to project:", insertError);
                  }
                  return !insertError;
                } catch (err) {
                  console.error("Exception adding user to project:", err);
                  return false;
                }
              });
              
              await Promise.all(projectUserPromises);
            }
            
            // Log emails that don't match any user
            if (foundUsers) {
              const unmatchedEmails = user_emails.filter(email => 
                !foundUsers.some(user => user.display_name === email)
              );
              
              if (unmatchedEmails.length > 0) {
                console.log("Some users were not found:", unmatchedEmails);
                toast.warning(`${unmatchedEmails.length} user(s) not found.`);
              }
            }
          }
        } catch (error) {
          console.error("Error updating users by email:", error);
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
