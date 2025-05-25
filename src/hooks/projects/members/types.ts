
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

// Export ProjectMember if it's defined here and not re-exported from ../types
// For consistency, it's better if ProjectMember is defined in ../types/member-types.ts and exported via ../types/index.ts
// export type { ProjectMember }; 
