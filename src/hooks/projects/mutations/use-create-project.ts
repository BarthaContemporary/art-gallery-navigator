
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CreateProjectInput } from "../types/project-types";

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
        // Find users by matching their display_name with provided names
        const { data: foundUsers, error: userError } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('display_name', user_emails);
        
        if (userError) {
          console.error("Error finding users:", userError);
          // We'll continue and just log the error
        }
        
        // Add found users to the project one by one to avoid RLS recursion issues
        if (foundUsers && foundUsers.length > 0) {
          for (const user of foundUsers) {
            try {
              const { error: insertError } = await supabase
                .from('project_users')
                .insert({
                  project_id: project.id,
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
        
        // Log unmatched usernames for potential invitation system
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
