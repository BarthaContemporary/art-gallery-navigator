
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useFetchMembers } from "./use-fetch-members";
// import { useAddMember } from "./use-add-member"; // Removed: useAddMember import
import { useRemoveMember } from "./use-remove-member";
import { UseProjectMembersResult, ProjectMember } from "./types"; // Added ProjectMember import explicitly if needed, though types.ts should export it.

/**
 * Custom hook for managing project members
 * Provides a centralized way to fetch and remove project members
 */
export function useProjectMembers(projectId: string | undefined): UseProjectMembersResult {
  const { user, isAdmin } = useAuth();
  
  const { 
    data: membersData, 
    isLoading: isFetchLoading, 
    isError, 
    error,
    refetch 
  } = useFetchMembers(projectId);
  
  const members = Array.isArray(membersData) ? membersData : [];
  
  // Add member mutation removed
  // const addMemberMutation = useAddMember(projectId); 
  
  const removeMemberMutation = useRemoveMember(projectId);
  
  // addMemberById function removed
  // const addMemberById = async (userId: string) => { ... };
  
  const removeMember = (userId: string) => {
    if (!projectId) {
      toast.error("Project ID is required");
      return;
    }
    
    if (userId === user?.id) {
      toast.warning("You cannot remove yourself from the project");
      return;
    }
    
    const memberToRemove = members.find(m => m.user_id === userId);
    if (memberToRemove?.is_admin) {
      // This check might be redundant if RLS prevents removing admins, but good for UI feedback.
      toast.info("Admin users automatically have access to all projects and cannot be removed this way.");
      return;
    }
    
    const nonAdminMembers = members.filter(m => !m.is_admin) || [];
    if (nonAdminMembers.length <= 1 && nonAdminMembers.some(m => m.user_id === userId)) {
      toast.warning("Projects must have at least one non-admin member if there are non-admin members.");
      return;
    }
    
    try {
      removeMemberMutation.mutate(userId);
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error("Failed to remove team member");
    }
  };
  
  const safeMembers = (Array.isArray(members) && members.length > 0) 
    ? members 
    : (user && user.id && user.email ? [{
        user_id: user.id,
        project_id: projectId || '',
        display_name: user.email || 'Current User',
        avatar_url: null, // Ensure avatar_url is present for ProjectMember type
        email: user.email,
        is_admin: isAdmin,
        // Add any other required fields for ProjectMember with default/fallback values
        role: null, // Example if 'role' was part of ProjectMember
      } as ProjectMember] : []); // Cast to ProjectMember
  
  return {
    members: safeMembers,
    isLoading: isFetchLoading || removeMemberMutation.isPending, // Removed addMemberMutation.isPending
    isError,
    error,
    refetch,
    // addMemberById, // Removed
    removeMember,
    // isAddingMember: addMemberMutation.isPending, // Removed
    isRemovingMember: removeMemberMutation.isPending
  };
}
