
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
        // Direct query to project_users instead of using RPC
        const { data: memberData, error: memberError } = await supabase
          .from('project_users')
          .select('user_id, project_id')
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
              email: user.email || null
            }];
          }
          
          return [];
        }
        
        if (!memberData || memberData.length === 0) return [];
        
        // Get profile information for each member in a single query
        const userIds = memberData.map(member => member.user_id);
        
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, email_confirmed')
          .in('id', userIds);
        
        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
          toast.error("Could not load team members' information");
          
          // Return partial data with user_ids, but no profile details
          return memberData.map(member => ({
            user_id: member.user_id,
            project_id: projectId,
            display_name: null,
            avatar_url: null,
            email: null
          }));
        }
        
        // Map the profile data to project members
        return memberData.map(member => {
          const profile = profilesData?.find(p => p.id === member.user_id);
          
          return {
            user_id: member.user_id,
            project_id: projectId,
            display_name: profile?.display_name || 'Unknown User',
            avatar_url: profile?.avatar_url || null,
            email: profile?.display_name || null  // Using display_name temporarily
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
        return [];
      }
    },
    enabled: !!projectId,
    retry: 1,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });
}
