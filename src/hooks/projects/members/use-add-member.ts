import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProjectMember } from "../types/member-types";

/**
 * Hook for adding project members
 */
export function useAddMember(projectId: string | undefined) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userId: string): Promise<ProjectMember> => {
      if (!projectId || !userId) {
        throw new Error("Project ID and user ID are required");
      }
      
      // Check if user is already a member
      const { data: existingMember, error: checkError } = await supabase
        .from('project_users')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .maybeSingle();
        
      if (checkError) throw checkError;
      
      if (existingMember) {
        throw new Error("User is already a member of this project");
      }
      
      // Add the member
      const { error: addError } = await supabase
        .from('project_users')
        .insert({
          project_id: projectId,
          user_id: userId
        });
        
      if (addError) throw addError;
      
      // Get the user profile, including email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, email') // Added email
        .eq('id', userId)
        .single(); // Use single as we expect one profile for a user ID
        
      if (profileError) throw profileError;
      if (!profile) throw new Error("User profile not found."); // Ensure profile exists
      
      // Check if user is admin
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'gallery_admin')
        .eq('user_id', userId)
        .maybeSingle();
      
      // Return the member data
      return {
        user_id: userId,
        project_id: projectId,
        display_name: profile.display_name || 'Unknown User',
        avatar_url: profile.avatar_url || null,
        email: profile.email ?? null, // Correctly use profile.email, fallback to null
        is_admin: !!adminRole
      } as ProjectMember;
    },
    onSuccess: (newMember) => {
      queryClient.setQueryData(
        ['project-members', projectId],
        (oldData: ProjectMember[] = []) => {
          // Ensure newMember is valid before adding
          if (newMember && newMember.user_id) {
            return [...oldData, newMember];
          }
          return oldData;
        }
      );
      // Toast success message is handled by UserSelectionField for this flow,
      // but keeping a generic one here can be a fallback.
      // toast.success(`Added ${newMember.display_name || 'new member'} to the project`);
    },
    onError: (error: Error) => {
      console.error("Error adding member:", error);
      toast.error(error.message || "Failed to add team member");
    }
  });
}
