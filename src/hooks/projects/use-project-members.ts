
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProjectMember } from "./types/project-types";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

// Interface to match the actual database structure
interface ProjectUserRecord {
  user_id: string;
  project_id: string;
}

// Interface for profile record
interface ProfileRecord {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  email_confirmed: boolean;
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
        
        // First get the user IDs of project members
        const { data: projectUsers, error: memberError } = await supabase
          .from('project_users')
          .select('user_id, project_id')
          .eq('project_id', projectId);
        
        if (memberError) {
          console.error("Error fetching project members:", memberError);
          toast.error("Failed to load team members");
          
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
        
        // Safety check for null or empty results
        if (!projectUsers || projectUsers.length === 0) {
          console.log("No members found for this project");
          return [];
        }
        
        // Extract just the user IDs into an array
        const userIds = projectUsers.map((member: ProjectUserRecord) => member.user_id);
        
        if (userIds.length === 0) {
          console.log("No valid user IDs found");
          return [];
        }
        
        console.log(`Found ${userIds.length} member IDs for project`);
        
        // Get profile information for each member in a single query
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds);
        
        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
          toast.error("Could not load team members' information");
          
          // Return partial data with user_ids, but no profile details
          return projectUsers.map((member: ProjectUserRecord) => ({
            user_id: member.user_id,
            project_id: projectId,
            display_name: null,
            avatar_url: null,
            email: null
          }));
        }
        
        // Safety check for profiles data
        if (!profiles) {
          console.log("No profiles found for member IDs");
          // Return basic member data without profile information
          return projectUsers.map((member: ProjectUserRecord) => ({
            user_id: member.user_id,
            project_id: projectId,
            display_name: null,
            avatar_url: null,
            email: null
          }));
        }
        
        console.log(`Found ${profiles.length} profiles for project members`);
        
        // Map the profile data to project members
        return projectUsers.map((member: ProjectUserRecord) => {
          const profile = profiles.find((p: ProfileRecord) => p.id === member.user_id);
          
          return {
            user_id: member.user_id,
            project_id: projectId,
            display_name: profile?.display_name || 'Unknown User',
            avatar_url: profile?.avatar_url,
            email: profile?.display_name // Using display_name as fallback for email
          };
        });
      } catch (error) {
        console.error("Exception in useProjectMembers:", error);
        toast.error("Failed to load project members");
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
    retry: 2,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });
}
