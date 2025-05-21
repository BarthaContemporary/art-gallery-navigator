
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ProjectMember, createMemberFromUser } from "../types/member-types";

/**
 * Hook for fetching project members
 */
export function useFetchMembers(projectId: string | undefined) {
  const { user, isAdmin } = useAuth();

  return useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async (): Promise<ProjectMember[]> => {
      if (!projectId) {
        console.log("No projectId provided to useFetchMembers");
        return [];
      }

      try {
        console.log(`Fetching members for project: ${projectId}`);
        
        // Get project users
        const { data: projectUsersData, error: projectUsersError } = await supabase
          .from('project_users')
          .select('user_id, project_id')
          .eq('project_id', projectId);

        // Ensure projectUsers is always an array
        const projectUsers = Array.isArray(projectUsersData) ? projectUsersData : [];

        if (projectUsersError) {
          console.error("Error fetching project members:", projectUsersError);
          // Return current user as fallback if available
          if (user && user.id && user.email) {
            return [createMemberFromUser(user.id, projectId, user.email, user.email, null, isAdmin)];
          }
          return [];
        }

        console.log(`Found ${projectUsers.length} project users`);
        
        // If no members found and user is signed in, add current user as fallback
        if (projectUsers.length === 0 && user && user.id && user.email) {
          return [createMemberFromUser(user.id, projectId, user.email, user.email, null, isAdmin)];
        }

        // Add all valid user IDs to a set
        let memberUserIds: string[] = [];
        if (projectUsers.length > 0) {
          // Filter out null/undefined ids
          memberUserIds = projectUsers
            .map(pu => pu.user_id)
            .filter(Boolean);
        }
        
        // If current user is admin, make sure they're included
        if (user && isAdmin && user.id) {
          if (!memberUserIds.includes(user.id)) {
            memberUserIds.push(user.id);
          }
        }

        // If we have no valid user IDs, return empty array
        if (memberUserIds.length === 0) {
          console.log("No valid member user IDs found");
          return [];
        }

        console.log(`Fetching profiles for ${memberUserIds.length} users`);
        
        // Fetch profiles for these users, including the email field
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, email') // Added email here
          .in('id', memberUserIds);

        // Ensure profiles is always an array
        const profiles = Array.isArray(profilesData) ? profilesData : [];

        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
          // Return current user as fallback if available
          if (user && user.id && user.email) {
            return [createMemberFromUser(user.id, projectId, user.email, user.email, null, isAdmin)];
          }
          return [];
        }

        console.log(`Found ${profiles.length} user profiles`);
        
        // Get admin users
        const { data: adminUsersData, error: adminError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'gallery_admin');

        // Ensure adminUsers is always an array
        const adminUsers = Array.isArray(adminUsersData) ? adminUsersData : [];
        
        if (adminError) {
          console.error("Error fetching admin users:", adminError);
        }

        // Create a set of admin user IDs
        let adminUserIds: Set<string> = new Set();
        if (adminUsers.length > 0) {
            adminUsers
              .filter(admin => admin && admin.user_id) // Filter out null/undefined
              .forEach(admin => adminUserIds.add(admin.user_id));
        }

        // Map profiles to members format
        const members: ProjectMember[] = memberUserIds.map(userId => {
          const profile = profiles.find(p => p.id === userId);
          const isUserAdmin = adminUserIds.has(userId) || (user?.id === userId && isAdmin);

          return createMemberFromUser(
            userId,
            projectId,
            profile?.display_name ?? null,
            profile?.email ?? null, // Pass profile's email
            profile?.avatar_url ?? null,
            isUserAdmin
          );
        });

        console.log(`Returning ${members.length} project members`);
        return members;
      } catch (err) {
        console.error("Critical error in useFetchMembers:", err);
        // Return current user as fallback if available
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
        console.error("Error in useFetchMembers React Query:", error);
      }
    }
  });
}
