import { Loader2, AlertCircle } from "lucide-react";
import { useProjectMembers } from "@/hooks/projects/use-project-members";
import { useAuth } from "@/hooks/use-auth";
import { MembersList } from "./MembersList";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
    removeMember,
    refetch
  } = useProjectMembers(projectId);

  const safeMembers = Array.isArray(members) ? members : [];

  const handleRemoveMember = (userId: string) => {
    if (readOnly || !isAdmin) return;
    
    if (!userId) return;
    
    if (userId === user?.id) {
      toast.warning("You cannot remove yourself from the project team.");
      return;
    }
    
    const memberToRemove = safeMembers.find(m => m.user_id === userId);
    if (memberToRemove?.is_admin) {
      toast.info("Admin users cannot be removed from projects.");
      return;
    }
    
    removeMember(userId);
  };

  const handleRetry = () => {
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

  if (!isAdmin) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Project team members can only be managed by administrators.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-3 flex items-center justify-between">
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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Team Members</label>
        </div>

        <div className="space-y-2">
          {safeMembers.length === 0 && !isLoading && !isError ? (
            <div className="text-sm text-muted-foreground">No team members assigned to this project.</div>
          ) : (
            <MembersList
              members={safeMembers}
              readOnly={readOnly || !isAdmin}
              onRemoveMember={handleRemoveMember}
            />
          )}
        </div>
      </div>

      {!readOnly && projectId && isAdmin && (
        <p className="mt-2 text-xs text-muted-foreground">
          As an admin, you can view and remove non-admin members. Adding members is handled via direct database assignments or future admin tools.
        </p>
      )}
    </div>
  );
}
