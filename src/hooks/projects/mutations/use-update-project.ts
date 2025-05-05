
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
      
      // Update users if provided (by username/display_name)
      if (user_emails !== undefined) {
        try {
          // Get current user
          const currentUser = await supabase.auth.getUser();
          if (currentUser.error) {
            throw currentUser.error;
          }
          
          const currentUserId = currentUser.data.user?.id;
          if (!currentUserId) {
            throw new Error("Could not determine current user");
          }
          
          // Delete all existing project users except the current user
          const { error: deleteError } = await supabase
            .from('project_users')
            .delete()
            .eq('project_id', id)
            .neq('user_id', currentUserId);
          
          if (deleteError) {
            console.error("Error deleting existing project users:", deleteError);
          }
          
          // Track users that couldn't be found
          const notFoundUsers = [];
          
          // Then add users one by one by username/display_name
          if (user_emails.length > 0) {
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
                  
                  // Check if this user is already added to avoid duplicates
                  const { data: existingUser } = await supabase
                    .from('project_users')
                    .select('id')
                    .eq('project_id', id)
                    .eq('user_id', userId)
                    .limit(1);
                  
                  if (!existingUser || existingUser.length === 0) {
                    // Add user to project
                    await supabase
                      .from('project_users')
                      .insert({
                        project_id: id,
                        user_id: userId
                      });
                  }
                } else {
                  notFoundUsers.push(username);
                  console.log(`User with username ${username} not found`);
                }
              } catch (err) {
                console.error(`Error processing user ${username}:`, err);
              }
            }
          }
          
          // Provide feedback about users that couldn't be found
          if (notFoundUsers.length > 0) {
            toast.warning(`Some users could not be found: ${notFoundUsers.join(', ')}`);
          }
        } catch (error) {
          console.error("Error updating users by username:", error);
          toast.error("Error updating team members");
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
