
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ProjectMember, createMemberFromUser } from "../types/member-types";
// Removed toast import as per previous diff, hooks shouldn't generally cause side-effects like toasts

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
        const { data: projectUsersData, error: projectUsersError } = await supabase
          .from('project_users')
          .select('user_id, project_id')
          .eq('project_id', projectId);

        // Ensure projectUsers is always an array for safety
        const projectUsers: { user_id: string; project_id: string }[] = Array.isArray(projectUsersData) ? projectUsersData : [];

        if (projectUsersError) {
          console.error("Error fetching project members:", projectUsersError);
          if (user && user.id && user.email) {
            return [createMemberFromUser(user.id, projectId, user.email, user.email, null, isAdmin)];
          }
          return [];
        }

        // If no members found and user is signed in, add current user as fallback
        // Also ensure user.id and user.email are present for creating a valid member
        if (projectUsers.length === 0 && user && user.id && user.email) {
          return [createMemberFromUser(user.id, projectId, user.email, user.email, null, isAdmin)];
        }

        // Initialize memberIds set
        let memberUserIdsInput: string[] = [];
        if (projectUsers.length > 0) {
          memberUserIdsInput = projectUsers.map(pu => pu.user_id).filter(id => id != null); // Filter out null/undefined ids
        }
        const memberIds = new Set(memberUserIdsInput);

        // If current user is admin, add them regardless (ensure user.id exists)
        if (user && isAdmin && user.id) {
          memberIds.add(user.id);
        }

        const userIds = Array.from(memberIds);

        if (userIds.length === 0) {
          return [];
        }

        // Fetch profiles for these users
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds);

        // Ensure profiles is always an array
        const profiles: { id: string; display_name: string | null; avatar_url: string | null; }[] = Array.isArray(profilesData) ? profilesData : [];

        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
          if (user && user.id && user.email) {
            return [createMemberFromUser(user.id, projectId, user.email, user.email, null, isAdmin)];
          }
          return [];
        }

        // Get admin users
        const { data: adminUsersData, error: adminError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'gallery_admin');

        // Ensure adminUsers is always an array
        const adminUsers: { user_id: string }[] = Array.isArray(adminUsersData) ? adminUsersData : [];
        
        if (adminError) {
          console.error("Error fetching admin users:", adminError);
        }

        let adminUserIdsInput: string[] = [];
        if (adminUsers.length > 0) {
            adminUserIdsInput = adminUsers.map(u => u.user_id).filter(id => id != null); // filter out null/undefined ids
        }
        const adminUserIds = new Set(adminUserIdsInput);

        // Map profiles to members format using createMemberFromUser helper
        const members: ProjectMember[] = userIds.map(userId => {
          const profile = profiles.find(p => p.id === userId);
          const isUserAdmin = adminUserIds.has(userId) || (user?.id === userId && isAdmin);

          // Assuming email is sourced from profile.display_name as per prior logic.
          // If profile.email is available, it should be used here.
          return createMemberFromUser(
            userId,
            projectId,
            profile?.display_name ?? 'Unknown User',
            profile?.display_name ?? null, // Placeholder for email, adjust if actual email available
            profile?.avatar_url ?? null,
            isUserAdmin
          );
        });

        return members;
      } catch (err) { // Changed error variable name for clarity
        console.error("Critical error in useFetchMembers queryFn catch block:", err); // Enhanced logging
        // Return current user as fallback for better UX, ensuring user details are present
        if (user && user.id && user.email) {
          return [createMemberFromUser(user.id, projectId, user.email, user.email, null, isAdmin)];
        }
        return [];
      }
    },
    enabled: !!projectId && !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    meta: {
      onError: (error: Error) => {
        console.error("Error in useFetchMembers React Query meta.onError:", error);
      }
    }
  });
}
