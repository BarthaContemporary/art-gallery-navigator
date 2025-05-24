
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2 } from "lucide-react";
import { UserData } from "./hooks/use-user-selection-data";
import { UserAvatarDisplay } from "./UserAvatarDisplay";

interface UserSelectionCommandListProps {
  availableUsers: UserData[]; // Users filtered by search term
  isLoading: boolean;
  isAdding: boolean;
  queryError: boolean;
  rawUsersCount: number; // Total users in system
  preSearchAvailableUsersCount: number; // Users available before search (rawUsers - currentMembers)
  onSelectUser: (user: UserData) => void;
}

export function UserSelectionCommandList({
  availableUsers,
  isLoading,
  isAdding,
  queryError,
  rawUsersCount,
  preSearchAvailableUsersCount,
  onSelectUser,
}: UserSelectionCommandListProps) {

  if (isLoading) { // Removed: && availableUsers.length === 0 && !queryError -> isLoading is enough
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
          Failed to load users. Please try closing and reopening the selection.
        </div>
      </CommandList>
    );
  }
  
  // At this point, not loading and no query error.
  // `availableUsers` are those matching current search.
  // `preSearchAvailableUsersCount` are those available before search.
  // `rawUsersCount` are total users in system.

  if (availableUsers.length === 0) { // No users match current search OR no users available at all
    let emptyMessage = "No users match your search.";
    let detailMessage = "Try a different search term or clear the search.";

    if (rawUsersCount === 0) {
      emptyMessage = "No users found in system.";
      detailMessage = "There are no user accounts to select from.";
    } else if (preSearchAvailableUsersCount === 0) {
      // This means rawUsersCount > 0, but after filtering out current project members, none are left.
      // Search term doesn't matter here if preSearch list was already empty.
      emptyMessage = "All eligible users are already added.";
      detailMessage = "There are no more users available to add to this project.";
    }
    // If preSearchAvailableUsersCount > 0 but availableUsers.length === 0,
    // it means a search is active and yielded no results.
    // The default emptyMessage and detailMessage cover this.

    return (
      <CommandList>
        <CommandEmpty>{emptyMessage}</CommandEmpty>
         <div className="py-6 text-center text-sm text-muted-foreground">
           {detailMessage}
         </div>
      </CommandList>
    );
  }

  return (
    <CommandList>
      {/* This CommandEmpty might be redundant if the block above catches all empty states.
          However, `cmdk` might still use it if `availableUsers` becomes empty dynamically post-initial render.
          Keeping it for safety, but its message should be generic. */}
      <CommandEmpty>No users found.</CommandEmpty>
      <CommandGroup>
        {availableUsers.map(user => {
          if (!user || !user.id || !(user.display_name || user.email)) {
            console.warn("UserSelectionCommandList: Skipping render for invalid user in map:", user);
            return null;
          }
          return (
            <CommandItem
              key={user.id}
              value={user.id} // Ensure value is string for cmdk
              onSelect={() => onSelectUser(user)}
              className="flex items-center gap-2"
              disabled={isAdding}
            >
              <UserAvatarDisplay user={user} />
              <span className="flex-grow">{user.display_name || user.email}</span>
            </CommandItem>
          );
        }).filter(Boolean)}
      </CommandGroup>
    </CommandList>
  );
}
