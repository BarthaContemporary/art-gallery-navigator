
import { useState, useEffect, useCallback } from "react";
import { ProjectMember } from "@/hooks/projects/types/member-types";
import { ProjectWithLocation } from "@/hooks/projects";
import { ProjectMemberSelect } from "@/components/projects/ProjectMemberSelect";
import { useProjectMembers } from "@/hooks/projects/use-project-members";

interface TeamMembersFieldProps {
  project?: ProjectWithLocation;
  onUserEmailsChange: (emails: string[]) => void;
}

export function TeamMembersField({ project, onUserEmailsChange }: TeamMembersFieldProps) {
  const { members: projectMembers, isLoading } = useProjectMembers(project?.id);
  
  // Handle member changes and extract emails for the form
  const handleMembersChange = useCallback((members: ProjectMember[]) => {
    const emails = members
      .map(member => member.email)
      .filter((email): email is string => !!email);
    
    onUserEmailsChange(emails);
  }, [onUserEmailsChange]);
  
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Project Team Members</label>
      
      {isLoading && project ? (
        <div className="text-sm text-muted-foreground">Loading team members...</div>
      ) : (
        <ProjectMemberSelect
          projectId={project?.id}
          readOnly={false}
        />
      )}
      
      <p className="text-xs text-muted-foreground">
        Enter email addresses of team members to invite to this project.
        This will grant them access to view and edit the project.
      </p>
    </div>
  );
}
