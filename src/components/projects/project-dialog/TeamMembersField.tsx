
import { useState, useEffect, useCallback } from "react";
import { useProjectMembers } from "@/hooks/projects/use-project-members";
import { ProjectWithLocation } from "@/hooks/projects";
import { ProjectUserEmailInput } from "@/components/projects/ProjectUserEmailInput";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

interface TeamMembersFieldProps {
  project?: ProjectWithLocation;
  onUserEmailsChange: (emails: string[]) => void;
}

export function TeamMembersField({ project, onUserEmailsChange }: TeamMembersFieldProps) {
  const { user } = useAuth();
  const { data: projectMembers = [], isLoading: isLoadingMembers, isError: membersError } = 
    useProjectMembers(project?.id);
  
  const [userEmails, setUserEmails] = useState<string[]>([]);
  
  // Extract email addresses from project members when available 
  useEffect(() => {
    if (Array.isArray(projectMembers) && projectMembers.length > 0) {
      const emails = projectMembers
        .map(member => member.email)
        .filter((email): email is string => !!email);
      
      if (emails.length > 0) {
        setUserEmails(emails);
        onUserEmailsChange(emails);
      } else if (user?.email) {
        // Fallback to current user if no members found
        setUserEmails([user.email]);
        onUserEmailsChange([user.email]);
      }
    } else if (user?.email) {
      // Fallback to current user if no members found
      setUserEmails([user.email]);
      onUserEmailsChange([user.email]);
    }
  }, [projectMembers, user, onUserEmailsChange]);

  // Show error if members couldn't be loaded
  useEffect(() => {
    if (membersError && project) {
      console.error("Failed to load project members:", membersError);
    }
  }, [membersError, project]);
  
  const handleUserEmailsChange = useCallback((emails: string[]) => {
    setUserEmails(emails);
    onUserEmailsChange(emails);
  }, [onUserEmailsChange]);
  
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Project Team Members</label>
      
      {isLoadingMembers && project ? (
        <div className="text-sm text-muted-foreground">Loading team members...</div>
      ) : (
        <ProjectUserEmailInput
          projectId={project?.id}
          onEmailsChange={handleUserEmailsChange}
          initialEmails={userEmails}
        />
      )}
      
      <p className="text-xs text-muted-foreground">
        Enter email addresses of team members to invite to this project.
        This will grant them access to view and edit the project.
      </p>
    </div>
  );
}
