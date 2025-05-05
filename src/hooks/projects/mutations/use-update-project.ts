
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CreateProjectInput } from "../types/project-types";

export function useUpdateProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<CreateProjectInput> }) => {
      if (!id) {
        throw new Error("Project ID is required for updating");
      }
      
      try {
        const { user_emails, ...projectData } = data;
        
        // Update the project
        const { error: updateError } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', id);
        
        if (updateError) {
          console.error("Error updating project:", updateError);
          throw new Error(`Failed to update project: ${updateError.message}`);
        }
        
        // Update users if provided
        if (user_emails !== undefined) {
          try {
            // Get current user
            const { data: currentUserData, error: currentUserError } = await supabase.auth.getUser();
            
            if (currentUserError) {
              throw new Error(`Error getting current user: ${currentUserError.message}`);
            }
            
            const currentUserId = currentUserData?.user?.id;
            if (!currentUserId) {
              throw new Error("No current user found, authentication may be required");
            }
            
            // First ensure current user is a member (if not already)
            const { data: existingMembership } = await supabase
              .from('project_users')
              .select('id')
              .eq('project_id', id)
              .eq('user_id', currentUserId)
              .maybeSingle();
            
            if (!existingMembership) {
              // Add current user to ensure they don't lose access
              await supabase
                .from('project_users')
                .insert({
                  project_id: id,
                  user_id: currentUserId
                });
            }
            
            // Delete existing project users except the current user
            const { error: deleteError } = await supabase
              .from('project_users')
              .delete()
              .eq('project_id', id)
              .neq('user_id', currentUserId);
            
            if (deleteError) {
              console.error("Error removing existing project users:", deleteError);
              // Continue anyway, we'll try to add the new users
            }
            
            // Track users that couldn't be found
            const notFoundUsers = [];
            
            // Then add users one by one
            if (user_emails && user_emails.length > 0) {
              for (const username of user_emails) {
                try {
                  if (!username.trim()) continue;
                  
                  // Skip if this is the current user (already ensured above)
                  const { data: profileData } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('display_name', username.trim())
                    .limit(1);
                  
                  if (!profileData || profileData.length === 0) {
                    notFoundUsers.push(username);
                    continue;
                  }
                  
                  const userId = profileData[0].id;
                  
                  // Skip if this is the current user (already ensured above)
                  if (userId === currentUserId) continue;
                  
                  // Add user to project
                  const { error: insertError } = await supabase
                    .from('project_users')
                    .insert({
                      project_id: id,
                      user_id: userId
                    });
                  
                  if (insertError) {
                    console.error(`Error adding user ${username} to project:`, insertError);
                  }
                } catch (err) {
                  console.error(`Error processing user ${username}:`, err);
                }
              }
            }
            
            if (notFoundUsers.length > 0) {
              toast.warning(`Some users could not be found: ${notFoundUsers.join(', ')}`);
            }
            
          } catch (error) {
            console.error("Error updating project users:", error);
            toast.error("Some team members couldn't be added to the project");
          }
        }
        
        return { id };
      } catch (error) {
        console.error("Project update failed:", error);
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      toast.success("Project updated successfully");
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', variables.id] });
    },
    onError: (error: any) => {
      console.error("Error in update project mutation:", error);
      const errorMessage = error?.message || "Failed to update project";
      toast.error(errorMessage);
    }
  });
}
