
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProjectMember } from "./types/project-types";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { User } from "@supabase/supabase-js";

// Helper function with correct type handling
function createCurrentUserMember(user: User, projectId: string): ProjectMember {
  return {
    user_id: user.id,
    project_id: projectId,
    display_name: user.email || 'Current User',
    avatar_url: null,
    email: user.email || null
  };
}

// Define a proper type for the joined data from Supabase
interface ProjectUserWithProfile {
  user_id: string;
  project_id: string;
  profiles?: {
    id?: string;
    display_name?: string;
    avatar_url?: string | null;
    email?: string | null;
  } | null;
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
        
        // Fetch project members with a single efficient query using proper join
        const { data: membersWithProfiles, error } = await supabase
          .from('project_users')
          .select(`
            user_id,
            project_id,
            profiles:user_id (
              id,
              display_name,
              avatar_url,
              email:display_name
            )
          `)
          .eq('project_id', projectId);
        
        if (error) {
          console.error("Error fetching project members:", error);
          toast.error("Failed to load team members");
          
          // Return at least the current user as fallback
          if (user) {
            return [createCurrentUserMember(user, projectId)];
          }
          return [];
        }
        
        // If no project users found, return the current user as fallback
        if (!membersWithProfiles || membersWithProfiles.length === 0) {
          console.log("No project users found, using current user as fallback");
          
          if (user) {
            return [createCurrentUserMember(user, projectId)];
          }
          return [];
        }
        
        // Type-safe mapping of joined data to project members
        const members: ProjectMember[] = (membersWithProfiles as ProjectUserWithProfile[]).map(item => {
          // Safely access potentially undefined profile properties
          const profile = item.profiles || {};
          
          return {
            user_id: item.user_id,
            project_id: projectId,
            display_name: profile.display_name || 'Unknown User',
            avatar_url: profile.avatar_url || null,
            email: profile.email || null
          };
        });
        
        // Always ensure current user is included if they have access
        if (user) {
          const currentUserIncluded = members.some(member => member.user_id === user.id);
          if (!currentUserIncluded) {
            members.push(createCurrentUserMember(user, projectId));
          }
        }
        
        return members;
      } catch (error) {
        console.error("Exception in useProjectMembers:", error);
        toast.error("Failed to load project members");
        
        // Return at least the current user as fallback
        if (user) {
          return [createCurrentUserMember(user, projectId)];
        }
        return [];
      }
    },
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });
}
