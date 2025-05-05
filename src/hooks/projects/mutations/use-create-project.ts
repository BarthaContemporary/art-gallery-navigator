
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CreateProjectInput } from "../types/project-types";

export function useCreateProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const { user_emails, ...projectData } = input;
      
      try {
        // First create the project
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .insert(projectData)
          .select()
          .single();
        
        if (projectError) {
          console.error("Error creating project:", projectError);
          throw new Error(`Failed to create project: ${projectError.message}`);
        }
        
        if (!project) {
          throw new Error("Project was not created, no data returned");
        }
        
        // Add the current user as a project member first to ensure access rights
        try {
          const currentUser = await supabase.auth.getUser();
          
          if (currentUser.error) {
            throw new Error(`Error getting current user: ${currentUser.error.message}`);
          }
          
          if (!currentUser.data?.user?.id) {
            throw new Error("No current user found, authentication may be required");
          }
          
          const { error: memberError } = await supabase
            .from('project_users')
            .insert({
              project_id: project.id,
              user_id: currentUser.data.user.id
            });
          
          if (memberError) {
            console.error("Error adding current user to project:", memberError);
            // Don't throw here, we'll continue with other users
          }
        } catch (err) {
          console.error("Error processing current user:", err);
          // Continue anyway as this is not critical
        }
        
        // Skip other users if none specified
        if (!user_emails || user_emails.length === 0) {
          return project;
        }
        
        // Find users by their display_name and add them individually
        const addedUsers = [];
        const notFoundUsers = [];
        
        for (const username of user_emails) {
          try {
            if (!username.trim()) continue;
            
            // Find user by display_name
            const { data: users, error: findError } = await supabase
              .from('profiles')
              .select('id')
              .eq('display_name', username.trim())
              .limit(1);
            
            if (findError) {
              console.error(`Error finding user with username ${username}:`, findError);
              continue;
            }
            
            if (!users || users.length === 0) {
              notFoundUsers.push(username);
              continue;
            }
            
            const userId = users[0].id;
            
            // Add user to project
            const { error: insertError } = await supabase
              .from('project_users')
              .insert({
                project_id: project.id,
                user_id: userId
              });
            
            if (insertError) {
              console.error(`Error adding user ${username} to project:`, insertError);
              continue;
            }
            
            addedUsers.push(username);
          } catch (err) {
            console.error(`Error processing user ${username}:`, err);
          }
        }
        
        // Provide feedback about users that couldn't be found
        if (notFoundUsers.length > 0) {
          toast.warning(`Some users could not be found: ${notFoundUsers.join(', ')}`);
        }
        
        return project;
      } catch (error) {
        console.error("Project creation failed:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Project created successfully");
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error: any) => {
      console.error("Error in create project mutation:", error);
      const errorMessage = error?.message || "Failed to create project";
      toast.error(errorMessage);
    }
  });
}
