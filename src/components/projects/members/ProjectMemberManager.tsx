
import { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { useProjectMembers } from "@/hooks/projects/use-project-members";
import { useAuth } from "@/hooks/use-auth";
import { ProjectMember } from "@/hooks/projects"; // Updated import
import { UserSelectionField } from "./UserSelectionField";
import { MembersList } from "./MembersList";
import { Button } from "@/components/ui/button";
import { ErrorDisplay } from "@/components/ui/error-display";

interface ProjectMemberManagerProps {
  projectId?: string;
  readOnly?: boolean;
}

export function ProjectMemberManager({ projectId, readOnly = false }: ProjectMemberManagerProps) {
  const { user, isAdmin } = useAuth();
  const {
    members,
    isLoading,
    isError,
    error,
    addMemberById,
    removeMember,
    refetch
  } = useProjectMembers(projectId);

  // Make sure members is always an array
  const safeMembers = Array.isArray(members) ? members : [];
  const [retryCount, setRetryCount] = useState(0);

  const handleRemoveMember = (userId: string) => {
    // Safety checks first
    if (!userId) return;
    
    // Don't allow removing yourself
    if (userId === user?.id) {
      return;
    }
    
    // Admin users shouldn't be removable through the UI since they have access by default
    const memberToRemove = safeMembers.find(m => m.user_id === userId);
    if (memberToRemove?.is_admin) {
      return;
    }
    
    removeMember(userId);
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    refetch();
  };

  if (isLoading && (!safeMembers || safeMembers.length === 0)) {
    return (
      <div className="flex items-center justify-center p-4 text-muted-foreground">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        <span>Loading members...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error display with retry button */}
      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-md flex items-center justify-between">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="text-sm">
              Failed to load team members: {(error as Error)?.message || "Unknown error"}
            </span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRetry}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Members list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Team Members</label>
          {isAdmin && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
              Admin Access
            </span>
          )}
        </div>

        <div className="space-y-2">
          {safeMembers.length === 0 && !isLoading && !isError ? (
            <div className="text-sm text-muted-foreground">No team members added yet</div>
          ) : (
            <MembersList
              members={safeMembers}
              readOnly={readOnly}
              onRemoveMember={handleRemoveMember}
            />
          )}
        </div>
      </div>

      {/* Add member selection */}
      {!readOnly && projectId && (
        <div>
          <UserSelectionField
            projectId={projectId}
            members={safeMembers}
            onAddMember={addMemberById}
          />
          
          <p className="mt-2 text-xs text-muted-foreground">
            {isAdmin 
              ? "As an admin, you have access to all projects. Other users need to be added explicitly."
              : "Select users from the dropdown to add them to this project."}
          </p>
        </div>
      )}
    </div>
  );
}

