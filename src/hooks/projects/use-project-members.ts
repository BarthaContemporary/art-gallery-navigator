
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProjectMember } from "./types/project-types";

export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async (): Promise<ProjectMember[]> => {
      if (!projectId) return [];
      
      try {
        // Join project_users with profiles in a single query
        const { data, error } = await supabase
          .from('project_users')
          .select(`
            user_id,
            project_id,
            profiles:profiles(
              id,
              display_name,
              avatar_url
            )
          `)
          .eq('project_id', projectId);
        
        if (error) throw error;
        if (!data || data.length === 0) return [];
        
        // Map to a flat structure to avoid type recursion
        return data.map(item => {
          // Safe type handling
          const profile = item.profiles as { 
            id?: string; 
            display_name?: string | null; 
            avatar_url?: string | null;
          } | null;
          
          return {
            user_id: item.user_id,
            project_id: item.project_id,
            display_name: profile?.display_name || null,
            avatar_url: profile?.avatar_url || null,
            // We don't have email in profiles, so we'll use display_name as email
            email: profile?.display_name || null
          };
        });
      } catch (error) {
        console.error("Error fetching project members:", error);
        throw error;
      }
    },
    enabled: !!projectId
  });
}
