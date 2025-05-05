
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreateProjectInput } from "../project-types";

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
      
      // Then add users if provided (by email)
      if (user_emails && user_emails.length > 0) {
        try {
          // Find users by email
          const { data: foundUsers, error: userError } = await supabase
            .from('profiles')
            .select('id')
            .in('email', user_emails);
          
          if (userError) throw userError;
          
          // Add found users to the project
          if (foundUsers && foundUsers.length > 0) {
            const projectUsers = foundUsers.map(user => ({
              project_id: project.id,
              user_id: user.id
            }));
            
            const { error: usersError } = await supabase
              .from('project_users')
              .insert(projectUsers);
            
            if (usersError) throw usersError;
          }
          
          // For unmatched emails, we could implement an invitation system later
          if (foundUsers) {
            const unmatchedEmails = user_emails.filter(email => 
              !foundUsers.some(user => user.id && email)
            );
            
            if (unmatchedEmails.length > 0) {
              console.log("Some emails were not matched to users:", unmatchedEmails);
            }
          }
        } catch (userError) {
          console.error("Error adding users by email:", userError);
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
