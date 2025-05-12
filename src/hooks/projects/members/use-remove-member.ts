
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProjectMember } from "../types/member-types";

/**
 * Hook for removing project members
 */
export function useRemoveMember(projectId: string | undefined) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userId: string) => {
      if (!projectId) {
        throw new Error("Project ID is required");
      }
      
      // Admin users cannot be removed as they have automatic access
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'gallery_admin')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (adminRole) {
        throw new Error("Admin users cannot be removed from projects");
      }
      
      const { error } = await supabase
        .from('project_users')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);
        
      if (error) throw error;
      
      return userId;
    },
    onSuccess: (userId) => {
      // Update the cache by filtering out the removed member
      queryClient.setQueryData(
        ['project-members', projectId],
        (oldData: ProjectMember[] = []) => oldData.filter(m => m.user_id !== userId)
      );
      
      toast.success("Team member removed");
    },
    onError: (error: Error) => {
      console.error("Error removing member:", error);
      toast.error(error.message || "Failed to remove team member");
    }
  });
}
