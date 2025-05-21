
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProjectMember, ProfileData } from "@/hooks/projects/types/member-types";

export function useAddMember(
  projectId: string | undefined,
  members: ProjectMember[],
  setMembers: (members: ProjectMember[]) => void,
  onMembersChange?: (members: ProjectMember[]) => void
) {
  const [emailInput, setEmailInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  const handleAddMember = async () => {
    const trimmedEmail = emailInput.trim();
    if (!trimmedEmail || !projectId) {
      if (!trimmedEmail) {
        toast.error("Email is required to add a member.");
        return;
      }
      toast.error("Project ID is required");
      return;
    }
    
    // Check for duplicates
    if (members.some(m => m.email?.toLowerCase() === trimmedEmail.toLowerCase())) {
      toast.warning(`${trimmedEmail} is already added to the project`);
      setEmailInput("");
      return;
    }
    
    setLoading(true);
    
    try {
      // Find user profile by email
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, email')
        .eq('email', trimmedEmail) // Look up by email field
        .single();
      
      if (profileError) {
        // PGRST116: "Searched for a single row, but 0 rows were found"
        if (profileError.code === 'PGRST116') { 
          toast.warning(`No user found with email ${trimmedEmail}`);
        } else {
          toast.error("Error finding user");
          console.error("Error finding user:", profileError);
        }
        setLoading(false);
        return;
      }
      
      // Ensure we have a valid profile
      if (!profileData || !profileData.id) {
        toast.error("Invalid user profile data received.");
        setLoading(false);
        return;
      }
      
      // Check if user is already a member (by user_id)
      const { data: existingMemberData } = await supabase
        .from('project_users')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', profileData.id)
        .maybeSingle();
        
      if (existingMemberData) {
        toast.info(`${profileData.display_name || trimmedEmail} is already a member of this project`);
        setLoading(false);
        return;
      }
      
      // Add the member
      const { error: addError } = await supabase
        .from('project_users')
        .insert({
          project_id: projectId,
          user_id: profileData.id
        });
        
      if (addError) throw addError;
      
      // Create member object and update state
      const newMember: ProjectMember = {
        user_id: profileData.id,
        project_id: projectId,
        display_name: profileData.display_name || trimmedEmail,
        avatar_url: profileData.avatar_url || null,
        email: profileData.email || trimmedEmail // Correctly use profile.email
      };
      
      const updatedMembers = [...members, newMember];
      setMembers(updatedMembers);
      onMembersChange?.(updatedMembers);
      
      toast.success(`Added ${newMember.display_name || trimmedEmail} to the project`);
    } catch (err) {
      console.error("Error adding team member:", err);
      const errorMessage = (err instanceof Error && err.message) ? err.message : "Failed to add team member";
      toast.error(errorMessage);
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
