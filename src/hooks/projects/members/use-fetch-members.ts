
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ProjectMember, createMemberFromUser } from "../types/member-types";

/**
 * Hook for fetching project members.
 * This hook ensures that all 'gallery_admin' users are always included in the member list for any project,
 * in addition to users explicitly assigned to the project via the 'project_users' table.
 */
export function useFetchMembers(projectId: string | undefined) {
  const { user } = useAuth(); // user from useAuth might be used for enabled flag or logging

  return useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async (): Promise<ProjectMember[]> => {
      if (!projectId) {
        console.log("No projectId provided to useFetchMembers");
        return [];
      }

      try {
        console.log(`Fetching members for project: ${projectId}`);
        
        // 1. Get user_ids for users EXPLICITLY assigned to the project
        const { data: projectUsersData, error: projectUsersError } = await supabase
          .from('project_users')
          .select('user_id') // Only need user_id
          .eq('project_id', projectId);

        if (projectUsersError) {
          console.error("Error fetching explicit project members:", projectUsersError);
          throw new Error(`Error fetching explicit project members: ${projectUsersError.message}`);
        }
        const explicitMemberIds = (projectUsersData || []).map(pu => pu.user_id).filter(Boolean);
        console.log(`Found ${explicitMemberIds.length} explicit project users for project ${projectId}`);
        
        // 2. Get user_ids for ALL gallery_admin users
        const { data: adminUsersData, error: adminError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'gallery_admin');

        if (adminError) {
          console.error("Error fetching admin users:", adminError);
          // This is critical for ensuring all admins are listed.
          throw new Error(`Error fetching admin users: ${adminError.message}`);
        }
        const allGlobalAdminUsers = Array.isArray(adminUsersData) ? adminUsersData : [];
        const allGlobalAdminIdsSet = new Set<string>();
        if (allGlobalAdminUsers.length > 0) {
            allGlobalAdminUsers
              .filter(admin => admin && admin.user_id)
              .forEach(admin => allGlobalAdminIdsSet.add(admin.user_id));
        }
        console.log(`Found ${allGlobalAdminIdsSet.size} global admin users.`);

        // 3. Combine explicit members and all global admins. Ensure uniqueness.
        const allRelevantUserIds = Array.from(new Set([...explicitMemberIds, ...allGlobalAdminIdsSet]));

        if (allRelevantUserIds.length === 0) {
          // This means no explicit users for this project AND no global admins in the system.
          console.log(`No relevant users (explicit members or global admins) for project ${projectId}.`);
          return [];
        }
        
        // 4. Fetch profiles for these combined users
        console.log(`Fetching profiles for ${allRelevantUserIds.length} relevant users (explicit + admins).`);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, email')
          .in('id', allRelevantUserIds);

        if (profilesError) {
          console.error("Error fetching profiles for relevant users:", profilesError);
          throw new Error(`Error fetching user profiles: ${profilesError.message}`);
        }
        const profiles = Array.isArray(profilesData) ? profilesData : [];
        console.log(`Found ${profiles.length} user profiles for relevant users.`);
        
        // 5. Construct ProjectMember objects for all relevant users
        const members: ProjectMember[] = allRelevantUserIds.map(userId => {
          const profile = profiles.find(p => p.id === userId);
          const isUserActuallyAdmin = allGlobalAdminIdsSet.has(userId); // Check if this user is in the set of all admins

          return createMemberFromUser(
            userId,
            projectId,
            profile?.display_name ?? null,
            profile?.email ?? null, // Pass email as string or null
            profile?.avatar_url ?? null,
            isUserActuallyAdmin // Set is_admin flag based on whether they are a global admin
          );
        });

        console.log(`Returning ${members.length} project members for project ${projectId} (now includes all admins).`);
        return members;

      } catch (err) {
        console.error("Critical error in useFetchMembers:", err);
        throw err; // Re-throw the error to be caught by React Query's error handling
      }
    },
    enabled: !!projectId && !!user, // Query runs if projectId is present and a user is logged in
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 2,
    meta: {
      onError: (error: Error) => {
        console.error("Error in useFetchMembers React Query:", error);
      }
    }
  });
}
