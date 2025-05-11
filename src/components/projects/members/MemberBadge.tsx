
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProjectMember } from "@/hooks/projects/types/member-types";

interface MemberBadgeProps {
  member: ProjectMember;
  isCurrentUser: boolean;
  readOnly: boolean;
  onRemove: (userId: string) => void;
}

export function MemberBadge({ 
  member, 
  isCurrentUser, 
  readOnly, 
  onRemove 
}: MemberBadgeProps) {
  // Get initials for avatar fallback
  const nameParts = member.display_name?.split(' ') || [];
  const initials = nameParts.length > 1 
    ? `${nameParts[0]?.charAt(0) || ''}${nameParts[1]?.charAt(0) || ''}`
    : member.display_name?.substring(0, 2) || 'U';
  
  return (
    <Badge 
      key={member.user_id} 
      variant="secondary" 
      className="px-2 py-1 flex items-center gap-1.5"
    >
      <Avatar className="h-5 w-5">
        <AvatarImage src={member.avatar_url || undefined} />
        <AvatarFallback className="text-xs">
          {initials.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span>{member.display_name}</span>
      {!readOnly && !isCurrentUser && (
        <X 
          className="h-3 w-3 ml-1 cursor-pointer hover:text-destructive" 
          onClick={() => onRemove(member.user_id)}
        />
      )}
    </Badge>
  );
}
