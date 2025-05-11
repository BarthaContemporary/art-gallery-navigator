
import { useState } from "react";
import { Loader2, X, UserPlus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProjectMembers } from "@/hooks/projects/use-project-members";
import { useAuth } from "@/hooks/use-auth";
import { ProjectMember } from "@/hooks/projects/types/member-types";

interface ProjectMemberManagerProps {
  projectId?: string;
  readOnly?: boolean;
}

export function ProjectMemberManager({ projectId, readOnly = false }: ProjectMemberManagerProps) {
  const [emailInput, setEmailInput] = useState("");
  const { user } = useAuth();
  const {
    members,
    isLoading,
    isError,
    error,
    addMember,
    removeMember,
    isAddingMember
  } = useProjectMembers(projectId);

  const handleAddMember = () => {
    addMember(emailInput);
    setEmailInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddMember();
    }
  };

  if (isLoading && !members.length) {
    return (
      <div className="flex items-center justify-center p-4 text-muted-foreground">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        <span>Loading members...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error display */}
      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-md flex items-center">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="text-sm">
            Failed to load team members: {(error as Error)?.message || "Unknown error"}
          </span>
        </div>
      )}

      {/* Members list */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Team Members</label>
        <div className="space-y-2">
          {members.length === 0 ? (
            <div className="text-sm text-muted-foreground">No team members added yet</div>
          ) : (
            members.map((member) => (
              <MemberBadge
                key={member.user_id}
                member={member}
                onRemove={!readOnly ? () => removeMember(member.user_id) : undefined}
                isCurrentUser={member.user_id === user?.id}
              />
            ))
          )}
        </div>
      </div>

      {/* Add member input */}
      {!readOnly && (
        <div className="flex items-center gap-2">
          <Input
            placeholder="Enter email address"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
            disabled={isAddingMember}
          />
          <Button
            type="button"
            onClick={handleAddMember}
            disabled={!emailInput.trim() || isAddingMember}
            className="flex items-center gap-1"
          >
            {isAddingMember ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            <span>Add</span>
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {readOnly
          ? "Project team members are shown above."
          : "Enter email addresses to add team members to this project."}
      </p>
    </div>
  );
}

// Member badge component
function MemberBadge({
  member,
  onRemove,
  isCurrentUser
}: {
  member: ProjectMember;
  onRemove?: () => void;
  isCurrentUser?: boolean;
}) {
  // Get initials for avatar fallback
  const nameParts = member.display_name?.split(' ') || [];
  const initials = nameParts.length > 1 
    ? `${nameParts[0]?.charAt(0) || ''}${nameParts[1]?.charAt(0) || ''}`
    : member.display_name?.substring(0, 2) || member.email?.substring(0, 2)?.toUpperCase() || 'U';

  return (
    <div className="flex items-center justify-between py-1 px-2 bg-muted/50 rounded-md">
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6">
          <AvatarImage src={member.avatar_url || undefined} />
          <AvatarFallback className="text-xs">
            {initials.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm">
          {member.display_name || member.email || 'Unknown user'}
          {isCurrentUser && <span className="text-xs ml-2 text-muted-foreground">(you)</span>}
        </span>
      </div>
      
      {onRemove && !isCurrentUser && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Remove</span>
        </Button>
      )}
    </div>
  );
}
