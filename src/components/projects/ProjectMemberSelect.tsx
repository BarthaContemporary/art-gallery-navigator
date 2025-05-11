
import { ProjectMemberManager } from "./members/ProjectMemberManager";

interface ProjectMemberSelectProps {
  projectId?: string;
  readOnly?: boolean;
}

export function ProjectMemberSelect({ projectId, readOnly = false }: ProjectMemberSelectProps) {
  return <ProjectMemberManager projectId={projectId} readOnly={readOnly} />;
}
