
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CreateProjectInput } from "../types/project-types";
import { Database } from "@/integrations/supabase/types";

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
        // Find users by matching their display_name with provided emails/names
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
              project_id: project.id,
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
        
        // Log unmatched emails for potential invitation system
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
