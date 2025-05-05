
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProjectMember } from "./types/project-types";

export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async (): Promise<ProjectMember[]> => {
      if (!projectId) return [];
      
      try {
        // First get all member user_ids for this project
        const { data: memberData, error: memberError } = await supabase
          .from('project_users')
          .select('user_id')
          .eq('project_id', projectId);
        
        if (memberError) {
          console.error("Error fetching project members:", memberError);
          throw memberError;
        }
        
        if (!memberData || memberData.length === 0) return [];
        
        // Get profile information for each member in a single query
        const userIds = memberData.map(member => member.user_id);
        
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds);
          
        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
          return memberData.map(member => ({
            user_id: member.user_id,
            project_id: projectId,
            display_name: null,
            avatar_url: null,
            email: null
          }));
        }
        
        if (!profilesData) return [];
        
        // Map the profile data to project members
        return memberData.map(member => {
          const profile = profilesData.find(p => p.id === member.user_id);
          
          return {
            user_id: member.user_id,
            project_id: projectId,
            display_name: profile?.display_name || null,
            avatar_url: profile?.avatar_url || null,
            email: profile?.display_name || null  // Using display_name as email as per original code
          };
        });
      } catch (error) {
        console.error("Error in useProjectMembers:", error);
        return []; // Return empty array instead of throwing to prevent app from crashing
      }
    },
    enabled: !!projectId,
    // Add reasonable error handling and stale time settings
    retry: 1,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });
}
