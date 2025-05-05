
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
      
      // Skip user association if no project was created or no users specified
      if (!project || !user_emails || user_emails.length === 0) {
        return project;
      }
      
      try {
        // Add the current user as a project member first
        const currentUser = await supabase.auth.getUser();
        
        if (!currentUser.error && currentUser.data.user) {
          await supabase
            .from('project_users')
            .insert({
              project_id: project.id,
              user_id: currentUser.data.user.id
            });
        }
      } catch (err) {
        console.error("Error adding current user to project:", err);
        // Continue anyway as this is not critical
      }
      
      // Find users by their display_name and add them individually
      const addedUsers = [];
      const notFoundUsers = [];
      
      for (const username of user_emails) {
        try {
          // Find user by display_name
          const { data: users, error: findError } = await supabase
            .from('profiles')
            .select('id')
            .eq('display_name', username)
            .limit(1);
          
          if (findError) {
            console.error(`Error finding user with username ${username}:`, findError);
            continue;
          }
          
          if (users && users.length > 0) {
            const userId = users[0].id;
            addedUsers.push(username);
            
            // Add user to project
            const { error: insertError } = await supabase
              .from('project_users')
              .insert({
                project_id: project.id,
                user_id: userId
              });
            
            if (insertError) {
              console.error(`Error adding user ${username} to project:`, insertError);
            }
          } else {
            notFoundUsers.push(username);
            console.log(`User with username ${username} not found`);
          }
        } catch (err) {
          console.error(`Error processing user ${username}:`, err);
        }
      }
      
      // Provide feedback about users that couldn't be found
      if (notFoundUsers.length > 0) {
        toast.warning(`Some users could not be found: ${notFoundUsers.join(', ')}`);
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
