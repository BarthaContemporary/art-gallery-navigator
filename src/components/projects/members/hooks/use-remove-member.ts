
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { ProjectMember } from "@/hooks/projects/types/member-types";

export function useRemoveMember(
  projectId?: string,
  members: ProjectMember[] = [],
  setMembers: (members: ProjectMember[]) => void,
  onMembersChange?: (members: ProjectMember[]) => void,
  readOnly: boolean = false
) {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  
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
    
    setLoading(true);
    
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
    } finally {
      setLoading(false);
    }
  };

  return {
    handleRemoveMember,
    loading
  };
}
