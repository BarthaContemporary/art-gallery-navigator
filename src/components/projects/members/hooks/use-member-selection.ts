
import { ProjectMember } from "@/hooks/projects/types/member-types";
import { useFetchMembers } from "./use-fetch-members";
import { useAddMember } from "./use-add-member";
import { useRemoveMember } from "./use-remove-member";

export function useMemberSelection(
  projectId?: string,
  initialMembers: ProjectMember[] = [],
  onMembersChange?: (members: ProjectMember[]) => void,
  readOnly: boolean = false
) {
  const { 
    members, 
    setMembers, 
    loading: fetchLoading, 
    error 
  } = useFetchMembers(projectId, initialMembers, onMembersChange, readOnly);
  
  const { 
    emailInput, 
    setEmailInput, 
    loading: addLoading, 
    handleAddMember 
  } = useAddMember(projectId, members, setMembers, onMembersChange);
  
  const { 
    handleRemoveMember, 
    loading: removeLoading 
  } = useRemoveMember(projectId, members, setMembers, onMembersChange, readOnly);
  
  // Combine loading states
  const loading = fetchLoading || addLoading || removeLoading;

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
