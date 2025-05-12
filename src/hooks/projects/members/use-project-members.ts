
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useFetchMembers } from "./use-fetch-members";
import { useAddMember } from "./use-add-member";
import { useRemoveMember } from "./use-remove-member";
import { UseProjectMembersResult } from "./types";

/**
 * Custom hook for managing project members
 * Provides a centralized way to fetch, add, and remove project members
 */
export function useProjectMembers(projectId: string | undefined): UseProjectMembersResult {
  const { user } = useAuth();
  
  // Fetch project members
  const { 
    data: members = [], 
    isLoading: isFetchLoading, 
    isError, 
    error,
    refetch 
  } = useFetchMembers(projectId);
  
  // Add member mutation
  const addMemberMutation = useAddMember(projectId);
  
  // Remove member mutation
  const removeMemberMutation = useRemoveMember(projectId);
  
  const addMemberById = async (userId: string) => {
    await addMemberMutation.mutateAsync(userId);
  };
  
  const removeMember = (userId: string) => {
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
    
    removeMemberMutation.mutate(userId);
  };
  
  return {
    members,
    isLoading: isFetchLoading || addMemberMutation.isPending || removeMemberMutation.isPending,
    isError,
    error,
    refetch,
    addMemberById,
    removeMember,
    isAddingMember: addMemberMutation.isPending,
    isRemovingMember: removeMemberMutation.isPending
  };
}
