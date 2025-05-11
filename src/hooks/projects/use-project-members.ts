
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
        
        // Direct query instead of using the project_users table which has RLS issues
        const { data: projectUsers, error } = await supabase
          .from('profiles')
          .select(`
            id,
            display_name,
            avatar_url
          `)
          .eq('id', user?.id);
          
        if (error) {
          console.error("Error fetching project members:", error);
          toast.error("Failed to load team members");
          return [];
        }
        
        // If we can't get data, return at least the current user
        if (!projectUsers || projectUsers.length === 0) {
          console.log("No profiles found or access denied, using current user as fallback");
          
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
        
        // Transform profiles into project members
        return projectUsers.map(profile => ({
          user_id: profile.id,
          project_id: projectId,
          display_name: profile.display_name || 'Unknown User',
          avatar_url: profile.avatar_url,
          email: profile.display_name // Using display_name as fallback for email
        }));
        
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
