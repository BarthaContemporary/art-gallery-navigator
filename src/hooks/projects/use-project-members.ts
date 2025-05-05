
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProjectMember } from "./types/project-types";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

// Define interface for the RPC return type to fix TypeScript errors
interface ProjectUserRPC {
  user_id: string;
  project_id: string;
}

export function useProjectMembers(projectId: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async (): Promise<ProjectMember[]> => {
      if (!projectId) return [];
      
      try {
        // First get all member user_ids for this project
        const { data: memberData, error: memberError } = await supabase
          .rpc('get_user_projects', { user_uuid: user?.id })
          .eq('project_id', projectId);
        
        if (memberError) {
          console.error("Error fetching project members using RPC:", memberError);
          
          // Fallback to direct query if RPC fails
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('project_users')
            .select('user_id, project_id')
            .eq('project_id', projectId);
          
          if (fallbackError) {
            console.error("Fallback error fetching project members:", fallbackError);
            
            // Return at least the current user if they're authenticated
            if (user) {
              return [{
                user_id: user.id,
                project_id: projectId,
                display_name: user.email || 'Current User',
                avatar_url: null,
                email: user.email || null
              }];
            }
            
            throw fallbackError;
          }
          
          if (!fallbackData || fallbackData.length === 0) return [];
          
          // Get profile information for each member
          const userIds = fallbackData.map(member => member.user_id);
          
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url, email_confirmed')
            .in('id', userIds);
          
          if (profilesError) {
            console.error("Error fetching profiles:", profilesError);
            toast.error("Could not load team members' information");
            
            // Return partial data with user_ids, but no profile details
            return fallbackData.map(member => ({
              user_id: member.user_id,
              project_id: projectId,
              display_name: null,
              avatar_url: null,
              email: null
            }));
          }
          
          // Map the profile data to project members
          return fallbackData.map(member => {
            const profile = profilesData?.find(p => p.id === member.user_id);
            
            return {
              user_id: member.user_id,
              project_id: projectId,
              display_name: profile?.display_name || 'Unknown User',
              avatar_url: profile?.avatar_url || null,
              email: profile?.display_name || null  // Fixed in a future update to use proper email field
            };
          });
        }
        
        if (!memberData || memberData.length === 0) return [];
        
        // Cast memberData to the correct type with user_id property
        const typedMemberData = memberData as unknown as ProjectUserRPC[];
        
        // Get profile information for each member in a single query
        const userIds = typedMemberData.map(member => member.user_id);
        
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, email_confirmed')
          .in('id', userIds);
        
        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
          toast.error("Could not load team members' information");
          
          // Return partial data with user_ids, but no profile details
          return typedMemberData.map(member => ({
            user_id: member.user_id,
            project_id: projectId,
            display_name: null,
            avatar_url: null,
            email: null
          }));
        }
        
        // Map the profile data to project members
        return typedMemberData.map(member => {
          const profile = profilesData?.find(p => p.id === member.user_id);
          
          return {
            user_id: member.user_id,
            project_id: projectId,
            display_name: profile?.display_name || 'Unknown User',
            avatar_url: profile?.avatar_url || null,
            email: profile?.display_name || null  // Fixed in a future update to use proper email field
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
            email: user.email || null
          }];
        }
        throw error;
      }
    },
    enabled: !!projectId,
    retry: 1,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });
}
