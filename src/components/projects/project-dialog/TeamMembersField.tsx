
import { useState, useEffect, useCallback } from "react";
import { useProjectMembers } from "@/hooks/projects/use-project-members";
import { ProjectWithLocation } from "@/hooks/projects";
import { ProjectUserEmailInput } from "@/components/projects/ProjectUserEmailInput";
import { toast } from "sonner";

interface TeamMembersFieldProps {
  project?: ProjectWithLocation;
  onUserNamesChange: (names: string[]) => void;
}

export function TeamMembersField({ project, onUserNamesChange }: TeamMembersFieldProps) {
  const { data: projectMembers = [], isLoading: isLoadingMembers, isError: membersError } = 
    useProjectMembers(project?.id);
  
  const [userNames, setUserNames] = useState<string[]>([]);
  
  // Extract usernames from project members when available - with memoization to prevent unnecessary re-renders
  const processMembers = useCallback(() => {
    if (Array.isArray(projectMembers) && projectMembers.length > 0) {
      const names = projectMembers
        .map(member => member.display_name)
        .filter((name): name is string => !!name);
      
      setUserNames(names);
    }
  }, [projectMembers]);
  
  useEffect(() => {
    processMembers();
  }, [projectMembers, processMembers]);

  // Show error if members couldn't be loaded
  useEffect(() => {
    if (membersError && project) {
      toast.error("Failed to load project members");
    }
  }, [membersError, project]);
  
  const handleUserNamesChange = useCallback((names: string[]) => {
    setUserNames(names);
    onUserNamesChange(names);
  }, [onUserNamesChange]);
  
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Project Team Members</label>
      
      {isLoadingMembers && project ? (
        <div className="text-sm text-muted-foreground">Loading team members...</div>
      ) : (
        <ProjectUserEmailInput
          onEmailsChange={handleUserNamesChange}
          initialEmails={userNames}
        />
      )}
      
      <p className="text-xs text-muted-foreground">
        Enter display names of team members to invite to this project.
        This will grant them access to view and edit the project.
      </p>
    </div>
  );
}
