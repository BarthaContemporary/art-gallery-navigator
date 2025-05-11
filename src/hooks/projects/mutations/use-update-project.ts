
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
        // Get current user
        const { data: currentUserData, error: currentUserError } = await supabase.auth.getUser();
        
        if (currentUserError) {
          throw new Error(`Error getting current user: ${currentUserError.message}`);
        }
        
        const currentUserId = currentUserData?.user?.id;
        if (!currentUserId) {
          throw new Error("No current user found, authentication may be required");
        }
        
        const { user_emails, ...projectData } = data;
        
        // Update the project
        if (Object.keys(projectData).length > 0) {
          const { error: updateError } = await supabase
            .from('projects')
            .update(projectData)
            .eq('id', id);
          
          if (updateError) {
            console.error("Error updating project:", updateError);
            throw new Error(`Failed to update project: ${updateError.message}`);
          }
        }
        
        // Update users if provided
        if (user_emails !== undefined) {
          try {
            // Ensure current user is a member (if not already)
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
            
            // Process each email individually
            const notFoundUsers: string[] = [];
            const addedUsers: string[] = [];
            
            if (user_emails && user_emails.length > 0) {
              for (const email of user_emails) {
                try {
                  if (!email.trim()) continue;
                  
                  // Find user by email (stored in display_name field of profiles)
                  const { data: profileData } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('display_name', email.trim())
                    .limit(1);
                  
                  if (!profileData || profileData.length === 0) {
                    notFoundUsers.push(email);
                    continue;
                  }
                  
                  const userId = profileData[0].id;
                  
                  // Skip if this is the current user (already ensured above)
                  if (userId === currentUserId) continue;
                  
                  // Check if user is already a member
                  const { data: existingUser } = await supabase
                    .from('project_users')
                    .select('id')
                    .eq('project_id', id)
                    .eq('user_id', userId)
                    .maybeSingle();
                    
                  if (existingUser) {
                    // User already added, skip
                    continue;
                  }
                  
                  // Add user to project
                  const { error: insertError } = await supabase
                    .from('project_users')
                    .insert({
                      project_id: id,
                      user_id: userId
                    });
                  
                  if (insertError) {
                    console.error(`Error adding user ${email} to project:`, insertError);
                  } else {
                    addedUsers.push(email);
                  }
                } catch (err) {
                  console.error(`Error processing user ${email}:`, err);
                }
              }
            }
            
            if (notFoundUsers.length > 0) {
              toast.warning(`Some users could not be found: ${notFoundUsers.join(', ')}`);
            }
            
            if (addedUsers.length > 0) {
              toast.success(`Added team members: ${addedUsers.join(', ')}`);
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
