
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CreateProjectInput } from "../types/project-types";
import { Database } from "@/integrations/supabase/types";

type ProfilesRow = Database['public']['Tables']['profiles']['Row'];

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
          }
          
          // Then add users by email
          if (user_emails.length > 0) {
            // Find users by matching their display_name with provided emails
            const { data: foundUsers, error: userError } = await supabase
              .from('profiles')
              .select('id, display_name')
              .in('display_name', user_emails);
            
            if (userError) {
              console.error("Error finding users:", userError);
            }
            
            // Add found users to the project
            if (foundUsers && foundUsers.length > 0) {
              // Insert users one by one to avoid potential bulk insert issues
              for (const user of foundUsers) {
                const projectUser = {
                  project_id: id,
                  user_id: user.id
                };
                
                const { error: insertError } = await supabase
                  .from('project_users')
                  .insert(projectUser);
                
                if (insertError) {
                  console.error("Error adding user to project:", insertError);
                }
              }
            }
            
            // Log emails that don't match any user
            if (foundUsers) {
              const unmatchedEmails = user_emails.filter(email => 
                !foundUsers.some(user => user.display_name === email)
              );
              
              if (unmatchedEmails.length > 0) {
                console.log("Some emails were not matched to users:", unmatchedEmails);
              }
            }
          }
        } catch (userError) {
          console.error("Error updating users by email:", userError);
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
