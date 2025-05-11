
import { ProjectMember, MemberOperationResult } from "@/hooks/projects/types/member-types";

export interface ProjectMembersContextType {
  members: ProjectMember[];
  loading: boolean;
  error: string | null;
  addMember: (projectId: string, email: string) => Promise<MemberOperationResult>;
  removeMember: (projectId: string, userId: string) => Promise<MemberOperationResult>;
  loadMembers: (projectId: string) => Promise<ProjectMember[]>;
}
