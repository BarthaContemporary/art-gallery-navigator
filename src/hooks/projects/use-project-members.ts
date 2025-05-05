
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Simple, flat type definitions to avoid recursive type references
export interface ProjectMember {
  user_id: string;
  project_id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

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
              avatar_url,
              email
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
            email?: string | null;
          } | null;
          
          return {
            user_id: item.user_id,
            project_id: item.project_id,
            display_name: profile?.display_name || null,
            avatar_url: profile?.avatar_url || null,
            email: profile?.email || null
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
