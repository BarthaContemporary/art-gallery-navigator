
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { 
  ProjectMember, 
  ProfileData, 
  isProfileData
} from "@/hooks/projects/types/member-types";

export function useFetchMembers(
  projectId: string | undefined,
  initialMembers: ProjectMember[] = [],
  onMembersChange?: (members: ProjectMember[]) => void,
  readOnly: boolean = false
) {
  const [members, setMembers] = useState<ProjectMember[]>(initialMembers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  
  // Update members when initialMembers changes
  useEffect(() => {
    if (Array.isArray(initialMembers) && 
        JSON.stringify(initialMembers) !== JSON.stringify(members) &&
        initialMembers.length > 0) {
      setMembers(initialMembers);
    }
  }, [initialMembers, members]);
  
  // Fetch members when projectId is available
  useEffect(() => {
    if (!projectId || !user || readOnly) return;
    
    const fetchProjectMembers = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const { data: projectUsers, error } = await supabase
          .from('project_users')
          .select(`
            user_id,
            project_id,
            profiles:user_id (
              id,
              display_name,
              avatar_url
            )
          `)
          .eq('project_id', projectId);
          
        if (error) throw new Error("Failed to load team members");
        
        const fetchedMembers: ProjectMember[] = [];
        
        // Process members from database
        if (projectUsers?.length) {
          projectUsers.forEach(pu => {
            const profileRaw = pu.profiles || {};
            
            if (!isProfileData(profileRaw)) {
              console.warn("Invalid profile data received:", profileRaw);
              return;
            }
            
            const profile: ProfileData = profileRaw;
            
            fetchedMembers.push({
              user_id: pu.user_id,
              project_id: projectId,
              display_name: profile.display_name || 'Unknown User',
              avatar_url: profile.avatar_url || null,
              email: profile.display_name || null // Using display_name as email
            });
          });
        }
        
        // Add current user if not present
        if (!fetchedMembers.some(m => m.user_id === user.id) && user.email) {
          fetchedMembers.push({
            user_id: user.id,
            project_id: projectId,
            display_name: user.email || 'Current User',
            avatar_url: null,
            email: user.email
          });
        }
        
        if (fetchedMembers.length > 0) {
          setMembers(fetchedMembers);
          onMembersChange?.(fetchedMembers);
        }
      } catch (err) {
        console.error("Error loading project members:", err);
        setError("Failed to load team members");
        
        // Fallback to current user
        if (user.email) {
          const currentUserMember: ProjectMember = {
            user_id: user.id,
            project_id: projectId,
            display_name: user.email,
            avatar_url: null,
            email: user.email
          };
          setMembers([currentUserMember]);
          onMembersChange?.([currentUserMember]);
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchProjectMembers();
  }, [projectId, user, onMembersChange, readOnly]);
  
  return {
    members,
    setMembers,
    loading,
    error
  };
}
