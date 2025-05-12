
import React, { useEffect } from "react";
import { ProjectWithLocation } from "@/hooks/projects";
import { ProjectMemberSelect } from "@/components/projects/ProjectMemberSelect";
import { useProjectMembers } from "@/hooks/projects/use-project-members";

interface TeamMembersFieldProps {
  project?: ProjectWithLocation;
  onUserEmailsChange: (emails: string[]) => void;
}

export function TeamMembersField({ project, onUserEmailsChange }: TeamMembersFieldProps) {
  const { members, isLoading } = useProjectMembers(project?.id);
  
  // Since we now use user selection by ID instead of emails, we can extract emails
  // from the members array whenever it changes
  useEffect(() => {
    if (members?.length) {
      const emails = members
        .map(member => member.email)
        .filter((email): email is string => !!email);
      
      onUserEmailsChange(emails);
    }
  }, [members, onUserEmailsChange]);
  
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
        Select team members to grant them access to view and edit this project. 
        Admin users automatically have access to all projects.
      </p>
    </div>
  );
}
