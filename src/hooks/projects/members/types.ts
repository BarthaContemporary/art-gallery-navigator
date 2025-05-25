
// import { ProjectMember } from "../types/member-types"; // Already in this file, or should be from base types
import { ProjectMember } from "../types"; // Assuming ProjectMember is in ../types/index.ts or ../types/member-types.ts

export interface UseProjectMembersResult {
  members: ProjectMember[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  // addMemberById removed
  removeMember: (userId: string) => void;
  // isAddingMember removed
  isRemovingMember: boolean;
}

