
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CreateProjectInput } from "../types/project-types";
import { Database } from "@/integrations/supabase/types";

type ProfilesRow = Database['public']['Tables']['profiles']['Row'];

export function useCreateProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const { user_emails, ...projectData } = input;
      
      // First create the project
      const { data: project, error } = await supabase
        .from('projects')
        .insert(projectData)
        .select()
        .single();
      
      if (error) throw error;
      
      // Handle user associations separately only if project was created successfully
      if (project && user_emails && user_emails.length > 0) {
        try {
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
                project_id: project.id,
                user_id: user.id
              };
              
              const { error: insertError } = await supabase
                .from('project_users')
                .insert(projectUser)
                .select();
              
              if (insertError) {
                console.error("Error adding user to project:", insertError);
              }
            }
          }
          
          // Log unmatched emails for potential invitation system
          if (foundUsers) {
            const unmatchedEmails = user_emails.filter(email => 
              !foundUsers.some(user => user.display_name === email)
            );
            
            if (unmatchedEmails.length > 0) {
              console.log("Some emails were not matched to users:", unmatchedEmails);
            }
          }
        } catch (userError) {
          console.error("Error adding users by email:", userError);
          // Continue with project creation even if adding users fails
        }
      }
      
      return project;
    },
    onSuccess: () => {
      toast.success("Project created successfully");
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error) => {
      console.error("Error creating project:", error);
      toast.error("Failed to create project");
    }
  });
}
