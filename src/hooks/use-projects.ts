
import {
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useProjectMembers,
  ProjectWithLocation,
  Project,
  ProjectMember,
  CreateProjectInput
} from "./projects";

// Re-export types for backward compatibility
export type { 
  Project, 
  ProjectWithLocation, 
  ProjectMember, 
  CreateProjectInput
};

// Re-export hooks for backward compatibility
export {
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useProjectMembers
} from "./projects";
