
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProjectMember } from "./types/member-types";
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
        
        // Fetch project members with profiles in a single query
        const { data: membersData, error } = await supabase
          .from('project_users')
          .select(`
            user_id,
            project_id,
            profiles:user_id (
              id,
              display_name,
              avatar_url
            )
          `)
          .eq('project_id', projectId);
        
        if (error) {
          console.error("Error fetching project members:", error);
          toast.error("Failed to load team members");
          
          // Return the current user as fallback if available
          if (user) {
            const currentMember = createMemberFromUser(user, projectId);
            return currentMember ? [currentMember] : [];
          }
          return [];
        }
        
        // If no members found, return current user as fallback
        if (!membersData || membersData.length === 0) {
          console.log("No project users found, using current user as fallback");
          
          if (user) {
            const currentMember = createMemberFromUser(user, projectId);
            return currentMember ? [currentMember] : [];
          }
          return [];
        }
        
        // Map the data to our ProjectMember type
        const members: ProjectMember[] = membersData.map(item => {
          const profile = item.profiles || {};
          
          return {
            user_id: item.user_id,
            project_id: projectId,
            display_name: profile.display_name || 'Unknown User',
            avatar_url: profile.avatar_url || null,
            email: profile.display_name || null // Using display_name as email
          };
        });
        
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
