import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useFetchMembers } from "./members/use-fetch-members";
import { useRemoveMember } from "./members/use-remove-member";
import { UseProjectMembersResult } from "./members/types";

/**
 * Custom hook for managing project members
 * Provides a centralized way to fetch and remove project members
 */
export function useProjectMembers(projectId: string | undefined): UseProjectMembersResult {
  const { user, isAdmin } = useAuth();
  
  // Fetch project members
  const { 
    data: membersData, 
    isLoading: isFetchLoading, 
    isError, 
    error,
    refetch 
  } = useFetchMembers(projectId);
  
  // Ensure members is always a valid array
  const members = Array.isArray(membersData) ? membersData : [];
  
  // Remove member mutation
  const removeMemberMutation = useRemoveMember(projectId);
  
  const removeMember = (userId: string) => {
    // Safety check - don't continue if no project ID
    if (!projectId) {
      toast.error("Project ID is required");
      return;
    }
    
    // Don't allow removing yourself
    if (userId === user?.id) {
      toast.warning("You cannot remove yourself from the project");
      return;
    }
    
    // Don't allow removing admin users
    const memberToRemove = members.find(m => m.user_id === userId);
    if (memberToRemove?.is_admin) {
      toast.info("Admin users automatically have access to all projects");
      return;
    }
    
    // Don't allow removing the last non-admin member
    const nonAdminMembers = members.filter(m => !m.is_admin) || [];
    if (nonAdminMembers.length <= 1 && nonAdminMembers.some(m => m.user_id === userId)) {
      toast.warning("Projects must have at least one member");
      return;
    }
    
    try {
      removeMemberMutation.mutate(userId);
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error("Failed to remove team member");
    }
  };
  
  // In case of an error or empty array, ensure we still have the current user as a fallback
  const safeMembers = (Array.isArray(members) && members.length > 0) 
    ? members 
    : (user && user.id && user.email ? [{
        user_id: user.id,
        project_id: projectId || '',
        display_name: user.email || 'Current User',
        avatar_url: null,
        email: user.email,
        is_admin: isAdmin
      }] : []);
  
  return {
    members: safeMembers,
    isLoading: isFetchLoading || removeMemberMutation.isPending,
    isError,
    error,
    refetch,
    removeMember,
    isRemovingMember: removeMemberMutation.isPending
  };
}
