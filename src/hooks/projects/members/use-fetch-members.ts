
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ProjectMember } from "../types/member-types";

/**
 * Hook for fetching project members
 */
export function useFetchMembers(projectId: string | undefined) {
  const { user, isAdmin } = useAuth();
  
  return useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async (): Promise<ProjectMember[]> => {
      if (!projectId) return [];
      
      try {
        // Get project users
        const { data: projectUsers, error: projectUsersError } = await supabase
          .from('project_users')
          .select('user_id, project_id')
          .eq('project_id', projectId);
          
        if (projectUsersError) throw projectUsersError;
        
        // Get all user IDs from project_users
        const memberIds = new Set(projectUsers?.map(pu => pu.user_id) || []);
        
        // If current user is admin, add them regardless
        if (user && isAdmin) {
          memberIds.add(user.id);
        }
        
        // If no members found and it's not a new project, return empty array
        if (memberIds.size === 0) {
          // For new projects, include the current user automatically
          if (user) {
            memberIds.add(user.id);
          }
          
          if (memberIds.size === 0) {
            return [];
          }
        }
        
        // Convert set to array
        const userIds = Array.from(memberIds);
        
        // Fetch profiles for these users
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds);
        
        if (profilesError) throw profilesError;
        
        // Get admin users
        const { data: adminUsers, error: adminError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'gallery_admin')
          .in('user_id', userIds);
          
        if (adminError) throw adminError;
        
        // Create a set of admin user IDs for quick lookup
        const adminUserIds = new Set(adminUsers?.map(u => u.user_id) || []);
        
        // Map profiles to members format
        const members: ProjectMember[] = userIds.map(userId => {
          const profile = profiles?.find(p => p.id === userId);
          const isUserAdmin = adminUserIds.has(userId);
          
          return {
            user_id: userId,
            project_id: projectId,
            display_name: profile?.display_name || 'Unknown User',
            avatar_url: profile?.avatar_url || null,
            email: profile?.display_name || null,
            is_admin: isUserAdmin
          };
        });
        
        return members;
      } catch (error) {
        console.error("Error fetching project members:", error);
        
        // Return current user as fallback if they're an admin
        if (user && isAdmin) {
          return [{
            user_id: user.id,
            project_id: projectId,
            display_name: user.email || 'Current User',
            avatar_url: null,
            email: user.email,
            is_admin: true
          }];
        }
        
        throw error;
      }
    },
    enabled: !!projectId && !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}
