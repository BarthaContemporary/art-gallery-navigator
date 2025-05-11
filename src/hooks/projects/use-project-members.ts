
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProjectMember, ProfileData, isProfileData } from "./types/member-types";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { User } from "@supabase/supabase-js";

// Helper function to create a member from user data
function createMemberFromUser(user: User | null, projectId: string): ProjectMember | null {
  if (!user) return null;
  
  return {
    user_id: user.id,
    project_id: projectId,
    display_name: user.email || 'Current User',
    avatar_url: null,
    email: user.email
  };
}

export function useProjectMembers(projectId: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async (): Promise<ProjectMember[]> => {
      if (!projectId) {
        console.log("No projectId provided to useProjectMembers");
        return [];
      }
      
      try {
        console.log(`Fetching members for project: ${projectId}`);
        
        // First get project users
        const { data: projectUsers, error: projectUsersError } = await supabase
          .from('project_users')
          .select('user_id, project_id')
          .eq('project_id', projectId);
        
        if (projectUsersError) {
          console.error("Error fetching project users:", projectUsersError);
          toast.error("Failed to load team members");
          
          // Return the current user as fallback if available
          if (user) {
            const currentMember = createMemberFromUser(user, projectId);
            return currentMember ? [currentMember] : [];
          }
          return [];
        }
        
        // If no members found, return current user as fallback
        if (!projectUsers || projectUsers.length === 0) {
          console.log("No project users found, using current user as fallback");
          
          if (user) {
            const currentMember = createMemberFromUser(user, projectId);
            return currentMember ? [currentMember] : [];
          }
          return [];
        }
        
        // Then fetch profiles for those users
        const userIds = projectUsers.map(pu => pu.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds);
        
        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
          toast.error("Failed to load user profiles");
          
          // Return the current user as fallback
          if (user) {
            const currentMember = createMemberFromUser(user, projectId);
            return currentMember ? [currentMember] : [];
          }
          return [];
        }
        
        // Map the data to our ProjectMember type with proper type checking
        const members: ProjectMember[] = [];
        
        // Match project users with their profiles
        for (const pu of projectUsers) {
          const profile = profiles?.find(p => p.id === pu.user_id);
          
          if (profile) {
            members.push({
              user_id: pu.user_id,
              project_id: projectId,
              display_name: profile.display_name || 'Unknown User',
              avatar_url: profile.avatar_url || null,
              email: profile.display_name || null // Using display_name as email
            });
          }
        }
        
        // Make sure current user is included if they have access
        if (user) {
          const currentUserIncluded = members.some(member => member.user_id === user.id);
          if (!currentUserIncluded) {
            const currentMember = createMemberFromUser(user, projectId);
            if (currentMember) {
              members.push(currentMember);
            }
          }
        }
        
        return members;
      } catch (error: any) {
        console.error("Exception in useProjectMembers:", error);
        toast.error("Failed to load project members");
        
        // Return current user as fallback
        if (user) {
          const currentMember = createMemberFromUser(user, projectId);
          return currentMember ? [currentMember] : [];
        }
        return [];
      }
    },
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });
}
