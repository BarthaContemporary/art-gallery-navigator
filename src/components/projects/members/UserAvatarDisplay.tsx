
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserData } from "./hooks/use-user-selection-data";

interface UserAvatarDisplayProps {
  user: UserData;
}

export function UserAvatarDisplay({ user }: UserAvatarDisplayProps) {
  const displayName = user.display_name || user.email || "Unnamed User";
  const fallbackInitials = (user.display_name?.substring(0, 2) || user.email?.substring(0,2) || "XX").toUpperCase();

  return (
    <>
      <Avatar className="h-6 w-6">
        <AvatarImage src={user.avatar_url || undefined} alt={displayName} />
        <AvatarFallback className="text-xs">
          {fallbackInitials}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className="text-sm font-medium">{displayName}</span>
        {user.email && user.display_name && user.email !== user.display_name && (
          <span className="text-xs text-muted-foreground">{user.email}</span>
        )}
      </div>
      {user.is_admin && (
        <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
          Admin
        </span>
      )}
    </>
  );
}
