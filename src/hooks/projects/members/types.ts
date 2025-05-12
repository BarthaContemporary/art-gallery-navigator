
import { ProjectMember } from "../types/member-types";

export interface UseProjectMembersResult {
  members: ProjectMember[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  addMemberById: (userId: string) => Promise<void>;
  removeMember: (userId: string) => void;
  isAddingMember: boolean;
  isRemovingMember: boolean;
}
