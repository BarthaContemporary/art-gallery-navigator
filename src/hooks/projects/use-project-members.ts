
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
      if (!projectId) return [];
      
      try {
        // First get the user IDs of project members
        const { data: memberIds, error: memberError } = await supabase
          .from('project_users')
          .select('user_id')
          .eq('project_id', projectId);
        
        if (memberError) {
          console.error("Error fetching project members:", memberError);
          
          // Return at least the current user if they're authenticated
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
        
        if (!memberIds || memberIds.length === 0) return [];
        
        // Extract just the user IDs into an array
        const userIds = memberIds.map(member => member.user_id);
        
        // Get profile information for each member in a single query
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds);
        
        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
          toast.error("Could not load team members' information");
          
          // Return partial data with user_ids, but no profile details
          return memberIds.map(member => ({
            user_id: member.user_id,
            project_id: projectId,
            display_name: null,
            avatar_url: null,
            email: null
          }));
        }
        
        // Map the profile data to project members
        return memberIds.map(member => {
          const profile = profiles?.find(p => p.id === member.user_id);
          
          return {
            user_id: member.user_id,
            project_id: projectId,
            display_name: profile?.display_name || 'Unknown User',
            avatar_url: profile?.avatar_url,
            email: profile?.display_name // Using display_name as fallback
          };
        });
      } catch (error) {
        console.error("Error in useProjectMembers:", error);
        // Return at least the current user if they're authenticated
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
    retry: 1,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });
}
