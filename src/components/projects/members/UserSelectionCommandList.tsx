
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2 } from "lucide-react";
import { UserData } from "./hooks/use-user-selection-data";
import { UserAvatarDisplay } from "./UserAvatarDisplay";

interface UserSelectionCommandListProps {
  availableUsers: UserData[];
  isLoading: boolean;
  isAdding: boolean;
  queryError: boolean;
  rawUsersCount: number;
  onSelectUser: (user: UserData) => void;
}

export function UserSelectionCommandList({
  availableUsers,
  isLoading,
  isAdding,
  queryError,
  rawUsersCount,
  onSelectUser,
}: UserSelectionCommandListProps) {
  if (isLoading && availableUsers.length === 0 && !queryError) {
    return (
      <CommandList>
        <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Loading users...
        </div>
      </CommandList>
    );
  }

  if (queryError) {
    return (
      <CommandList>
        <CommandEmpty>Error loading users.</CommandEmpty>
        <div className="py-6 text-center text-sm text-destructive">
          Failed to load users.
        </div>
      </CommandList>
    );
  }
  
  if (!isLoading && availableUsers.length === 0) {
     return (
      <CommandList>
        <CommandEmpty>
          {rawUsersCount === 0 ? "No users found in system." :
           "All users already added or no suitable users found."}
        </CommandEmpty>
         <div className="py-6 text-center text-sm text-muted-foreground">
           {rawUsersCount > 0 ? "All users already added or no suitable users found." : "No users available."}
         </div>
      </CommandList>
    );
  }

  return (
    <CommandList>
      <CommandEmpty>No users match your search.</CommandEmpty>
      <CommandGroup>
        {availableUsers.map(user => {
          if (!user || !user.id || !(user.display_name || user.email)) {
            console.warn("UserSelectionCommandList: Skipping render for invalid user in map:", user);
            return null;
          }
          return (
            <CommandItem
              key={user.id}
              value={user.id}
              onSelect={() => onSelectUser(user)}
              className="flex items-center gap-2"
              disabled={isAdding}
            >
              <UserAvatarDisplay user={user} />
            </CommandItem>
          );
        }).filter(Boolean)}
      </CommandGroup>
    </CommandList>
  );
}
