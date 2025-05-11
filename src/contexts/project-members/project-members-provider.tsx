
import { createContext, useContext, ReactNode } from "react";
import { ProjectMembersContextType } from "./types";
import { useProjectMembersApi } from "./use-project-members-api";

const ProjectMembersContext = createContext<ProjectMembersContextType | undefined>(undefined);

export function ProjectMembersProvider({ children }: { children: ReactNode }) {
  const {
    members,
    loading,
    error,
    loadMembers,
    addMember,
    removeMember
  } = useProjectMembersApi();

  return (
    <ProjectMembersContext.Provider
      value={{
        members,
        loading,
        error,
        addMember,
        removeMember,
        loadMembers
      }}
    >
      {children}
    </ProjectMembersContext.Provider>
  );
}

export function useProjectMembers() {
  const context = useContext(ProjectMembersContext);
  if (context === undefined) {
    throw new Error("useProjectMembers must be used within a ProjectMembersProvider");
  }
  return context;
}
