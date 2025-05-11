import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ProjectMember } from "@/hooks/projects/types/member-types";
import { MembersList } from "./members/MembersList";
import { AddMemberInput } from "./members/AddMemberInput";
import { useMemberSelection } from "./members/hooks/use-member-selection";

interface ProjectMemberSelectProps {
  projectId?: string;
  initialMembers?: ProjectMember[];
  onMembersChange?: (members: ProjectMember[]) => void;
  readOnly?: boolean;
}

export function ProjectMemberSelect({ 
  projectId,
  initialMembers = [],
  onMembersChange,
  readOnly = false
}: ProjectMemberSelectProps) {
  const {
    members,
    loading,
    error,
    emailInput,
    setEmailInput,
    handleAddMember,
    handleRemoveMember
  } = useMemberSelection(projectId, initialMembers, onMembersChange, readOnly);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddMember();
    }
  };
  
  return (
    <ErrorBoundary fallback={
      <div className="text-red-500 p-2 border border-red-300 rounded">
        Error loading member selection
      </div>
    }>
      <div className="space-y-3">
        {loading && !members.length ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-5 w-5 mr-2 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Loading members...</span>
          </div>
        ) : error ? (
          <div className="text-sm text-red-500">{error}</div>
        ) : (
          <>
            {/* Members List */}
            <MembersList
              members={members}
              readOnly={readOnly}
              onRemoveMember={handleRemoveMember}
            />
            
            {/* Add Member Input */}
            {!readOnly && (
              <AddMemberInput
                emailInput={emailInput}
                onEmailChange={setEmailInput}
                onAddMember={handleAddMember}
                onKeyDown={handleInputKeyDown}
                loading={loading}
              />
            )}
          </>
        )}
        
        {!readOnly && (
          <p className="text-xs text-muted-foreground">
            Enter email addresses of team members to invite to this project.
          </p>
        )}
      </div>
    </ErrorBoundary>
  );
}
