
import { useAuth } from "@/hooks/use-auth";
import { ProjectMember } from "@/hooks/projects/types/member-types";
import { MemberBadge } from "./MemberBadge";

interface MembersListProps {
  members: ProjectMember[];
  readOnly: boolean;
  onRemoveMember: (userId: string) => void;
}

export function MembersList({ 
  members, 
  readOnly, 
  onRemoveMember 
}: MembersListProps) {
  const { user } = useAuth();
  
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {members.map(member => (
        <MemberBadge
          key={member.user_id}
          member={member}
          isCurrentUser={member.user_id === user?.id}
          readOnly={readOnly}
          onRemove={() => onRemoveMember(member.user_id)}
        />
      ))}
    </div>
  );
}
