
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ProjectMember } from "../types/member-types";
import { toast } from "sonner";

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
        // Get project users with error handling
        const { data: projectUsers, error: projectUsersError } = await supabase
          .from('project_users')
          .select('user_id, project_id')
          .eq('project_id', projectId);
          
        if (projectUsersError) {
          console.error("Error fetching project members:", projectUsersError);
          
          // Return current user as fallback if we're encountering a database error
          if (user) {
            return [{
              user_id: user.id,
              project_id: projectId,
              display_name: user.email || 'Current User',
              avatar_url: null,
              email: user.email,
              is_admin: isAdmin
            }];
          }
          return [];
        }
        
        // If no members found and user is signed in, add current user as fallback
        if ((!projectUsers || projectUsers.length === 0) && user) {
          return [{
            user_id: user.id,
            project_id: projectId,
            display_name: user.email || 'Current User',
            avatar_url: null,
            email: user.email,
            is_admin: isAdmin
          }];
        }
        
        // Get all user IDs from project_users
        const memberIds = new Set(projectUsers?.map(pu => pu.user_id) || []);
        
        // If current user is admin, add them regardless
        if (user && isAdmin) {
          memberIds.add(user.id);
        }
        
        // Convert set to array
        const userIds = Array.from(memberIds);
        
        if (userIds.length === 0) {
          return [];
        }
        
        // Fetch profiles for these users
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds);
        
        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
          // Return minimal data for current user as fallback
          if (user) {
            return [{
              user_id: user.id,
              project_id: projectId,
              display_name: user.email || 'Current User',
              avatar_url: null,
              email: user.email,
              is_admin: isAdmin
            }];
          }
          return [];
        }
        
        // Get admin users
        const { data: adminUsers, error: adminError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'gallery_admin');
          
        if (adminError) {
          console.error("Error fetching admin users:", adminError);
        }
        
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
            is_admin: isUserAdmin || (userId === user?.id && isAdmin)
          };
        });
        
        return members;
      } catch (error) {
        console.error("Error in useFetchMembers:", error);
        
        // Return current user as fallback for better UX
        if (user) {
          return [{
            user_id: user.id,
            project_id: projectId,
            display_name: user.email || 'Current User',
            avatar_url: null,
            email: user.email,
            is_admin: isAdmin
          }];
        }
        
        return [];
      }
    },
    enabled: !!projectId && !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    
    // Improve error handling to prevent UI breakage
    meta: {
      onError: (error: Error) => {
        console.error("Error in useFetchMembers query:", error);
      }
    }
  });
}
