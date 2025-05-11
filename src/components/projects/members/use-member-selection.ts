
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { 
  ProjectMember, 
  ProfileData, 
  isProfileData
} from "@/hooks/projects/types/member-types";

export function useMemberSelection(
  projectId?: string,
  initialMembers: ProjectMember[] = [],
  onMembersChange?: (members: ProjectMember[]) => void,
  readOnly: boolean = false
) {
  const [members, setMembers] = useState<ProjectMember[]>(initialMembers);
  const [emailInput, setEmailInput] = useState("");
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
    
    async function fetchProjectMembers() {
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
          
        if (error) {
          throw new Error("Failed to load team members");
        }
        
        const fetchedMembers: ProjectMember[] = [];
        
        // Process members from database
        if (projectUsers && projectUsers.length > 0) {
          projectUsers.forEach(pu => {
            // Use our enhanced type guard for more safety
            const profileRaw = pu.profiles || {};
            
            // Apply the improved type guard
            if (!isProfileData(profileRaw)) {
              console.warn("Invalid profile data received:", profileRaw);
              return; // Skip this item
            }
            
            // Now TypeScript knows profileRaw is ProfileData
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
        const currentUserInMembers = fetchedMembers.some(m => m.user_id === user.id);
        
        if (!currentUserInMembers && user.email) {
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
    }
    
    fetchProjectMembers();
  }, [projectId, user, onMembersChange, readOnly]);
  
  const handleAddMember = async () => {
    const email = emailInput.trim();
    
    if (!email) return;
    if (!projectId) {
      toast.error("Project ID is required");
      return;
    }
    
    // Check for duplicates
    if (members.some(m => m.email?.toLowerCase() === email.toLowerCase())) {
      toast.warning(`${email} is already added to the project`);
      setEmailInput("");
      return;
    }
    
    setLoading(true);
    
    try {
      // Find user profile by email (display_name field)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('display_name', email)
        .single();
      
      if (profileError) {
        if (profileError.code === 'PGRST116') {
          toast.warning(`No user found with email ${email}`);
        } else {
          toast.error("Error finding user");
          console.error("Error finding user:", profileError);
        }
        setLoading(false);
        setEmailInput("");
        return;
      }
      
      // Enhanced type handling with strong defaults
      const safeProfile: ProfileData = isProfileData(profileData) ? profileData : {};
      const profileId = safeProfile.id;
      
      // Safety check for profile ID
      if (!profileId) {
        toast.error("Invalid user profile");
        setLoading(false);
        setEmailInput("");
        return;
      }
      
      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('project_users')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', profileId)
        .single();
        
      if (existingMember) {
        toast.info(`${email} is already a member of this project`);
        setLoading(false);
        setEmailInput("");
        return;
      }
      
      // Add the member
      const { error: addError } = await supabase
        .from('project_users')
        .insert({
          project_id: projectId,
          user_id: profileId
        });
        
      if (addError) {
        throw addError;
      }
      
      // Create member object
      const newMember: ProjectMember = {
        user_id: profileId,
        project_id: projectId,
        display_name: safeProfile.display_name || email,
        avatar_url: safeProfile.avatar_url || null,
        email: email
      };
      
      // Update state
      const updatedMembers = [...members, newMember];
      setMembers(updatedMembers);
      onMembersChange?.(updatedMembers);
      
      toast.success(`Added ${email} to the project`);
    } catch (err) {
      console.error("Error adding team member:", err);
      toast.error("Failed to add team member");
    } finally {
      setLoading(false);
      setEmailInput("");
    }
  };
  
  const handleRemoveMember = async (memberId: string) => {
    if (!projectId || readOnly) return;
    
    // Don't allow removing the last member
    if (members.length <= 1) {
      toast.warning("Projects must have at least one member");
      return;
    }
    
    // Don't allow removing yourself
    if (memberId === user?.id) {
      toast.warning("You cannot remove yourself from the project");
      return;
    }
    
    try {
      const { error } = await supabase
        .from('project_users')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', memberId);
        
      if (error) throw error;
      
      // Update state
      const updatedMembers = members.filter(m => m.user_id !== memberId);
      setMembers(updatedMembers);
      onMembersChange?.(updatedMembers);
      
      toast.success("Team member removed");
    } catch (err) {
      console.error("Error removing team member:", err);
      toast.error("Failed to remove team member");
    }
  };

  return {
    members,
    loading,
    error,
    emailInput,
    setEmailInput,
    handleAddMember,
    handleRemoveMember
  };
}
