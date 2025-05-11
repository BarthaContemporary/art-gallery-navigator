
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProjectMember, ProfileData, isProfileData } from "@/hooks/projects/types/member-types";

export function useAddMember(
  projectId?: string,
  members: ProjectMember[] = [],
  setMembers: (members: ProjectMember[]) => void,
  onMembersChange?: (members: ProjectMember[]) => void
) {
  const [emailInput, setEmailInput] = useState("");
  const [loading, setLoading] = useState(false);
  
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
  
  return {
    emailInput,
    setEmailInput,
    loading,
    handleAddMember
  };
}
