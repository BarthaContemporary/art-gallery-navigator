
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProjectMember } from "./types/project-types";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

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
        
        // Fetch profiles based on project_users table directly (avoiding joins that cause RLS issues)
        const { data: projectUsers, error } = await supabase
          .from('project_users')
          .select('user_id, project_id')
          .eq('project_id', projectId);
          
        if (error) {
          console.error("Error fetching project members:", error);
          toast.error("Failed to load team members");
          
          // Return at least the current user as fallback
          if (user) {
            return [{
              user_id: user.id,
              project_id: projectId,
              display_name: user.email || 'Current User',
              avatar_url: null,
              email: user.email
            }];
          }
          return [];
        }
        
        // If no project users found, return the current user as fallback
        if (!projectUsers || projectUsers.length === 0) {
          console.log("No project users found, using current user as fallback");
          
          if (user) {
            return [{
              user_id: user.id,
              project_id: projectId,
              display_name: user.email || 'Current User',
              avatar_url: null,
              email: user.email
            }];
          }
          return [];
        }
        
        // Get user IDs from project_users
        const userIds = projectUsers.map(pu => pu.user_id);
        
        // Fetch profile data for these users
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds);
          
        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
          
          // Return basic member data without profiles
          return projectUsers.map(pu => ({
            user_id: pu.user_id,
            project_id: projectId,
            display_name: pu.user_id === user?.id ? (user.email || 'Current User') : 'Unknown User',
            avatar_url: null,
            email: pu.user_id === user?.id ? user.email : undefined
          }));
        }
        
        // Map profiles to project members
        const members: ProjectMember[] = projectUsers.map(pu => {
          const profile = profiles?.find(p => p.id === pu.user_id);
          return {
            user_id: pu.user_id,
            project_id: projectId,
            display_name: profile?.display_name || (pu.user_id === user?.id ? (user.email || 'Current User') : 'Unknown User'),
            avatar_url: profile?.avatar_url || null,
            email: pu.user_id === user?.id ? user.email : profile?.display_name // Using display_name as fallback for email
          };
        });
        
        // Always ensure current user is included if they have access
        const currentUserIncluded = members.some(member => member.user_id === user?.id);
        if (user && !currentUserIncluded) {
          members.push({
            user_id: user.id,
            project_id: projectId,
            display_name: user.email || 'Current User',
            avatar_url: null,
            email: user.email
          });
        }
        
        return members;
        
      } catch (error) {
        console.error("Exception in useProjectMembers:", error);
        toast.error("Failed to load project members");
        
        // Return at least the current user as fallback
        if (user) {
          return [{
            user_id: user.id,
            project_id: projectId,
            display_name: user.email || 'Current User',
            avatar_url: null,
            email: user.email
          }];
        }
        return [];
      }
    },
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });
}
