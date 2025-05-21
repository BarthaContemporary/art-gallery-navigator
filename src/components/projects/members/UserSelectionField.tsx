import { useState, useEffect } from "react";
import { Command, CommandInput } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { ProjectMember } from "@/hooks/projects";
import { useUserSelectionData, UserData } from "./hooks/use-user-selection-data";
import { UserSelectionCommandList } from "./UserSelectionCommandList";
import { UserSelectionPopoverTrigger } from "./UserSelectionPopoverTrigger";

interface UserSelectionFieldProps {
  projectId?: string;
  disabled?: boolean;
  onAddMember?: (userId: string) => Promise<void>;
  members: ProjectMember[];
}

export function UserSelectionField({ 
  projectId, 
  disabled = false, 
  onAddMember,
  members 
}: UserSelectionFieldProps) {
  const [open, setOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [search, setSearch] = useState(""); // Search state managed here

  const { 
    rawUsers,
    availableUsers, 
    isLoadingUsers, 
    usersQueryError 
  } = useUserSelectionData(open, disabled, members);

  // Filter availableUsers based on search term locally
  const filteredUsers = availableUsers.filter(user => {
    const displayName = user.display_name || "";
    const email = user.email || "";
    return displayName.toLowerCase().includes(search.toLowerCase()) ||
           email.toLowerCase().includes(search.toLowerCase());
  });

  useEffect(() => {
    if (open) {
      console.log("UserSelectionField: Debug Info", {
        isLoadingUsers,
        usersQueryError,
        rawUsersCount: rawUsers?.length,
        currentMembersCount: members?.length,
        availableUsersForSelectionInHookCount: availableUsers?.length,
        search,
        filteredUsersForDisplayCount: filteredUsers?.length,
      });
    }
  }, [open, isLoadingUsers, usersQueryError, rawUsers, members, availableUsers, search, filteredUsers]);

  const handleSelectUser = async (user: UserData) => {
    if (!projectId || !onAddMember || !user || !user.id) {
      console.error("UserSelectionField: Missing data for handleSelectUser", { projectId, onAddMember, user });
      toast.error("Cannot add user: critical information missing.");
      return;
    }
    
    setIsAdding(true);
    try {
      await onAddMember(user.id);
      setOpen(false);
      setSearch(""); // Reset search after adding
    } catch (error) {
      console.error("UserSelectionField: Error adding user to project:", error);
      const errorMsg = error instanceof Error ? error.message : "Failed to add user to project";
      toast.error(errorMsg);
    } finally {
      setIsAdding(false);
    }
  };
  
  return (
    <div>
      <Popover open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) setSearch(""); // Reset search when closing
      }}>
        <PopoverTrigger asChild>
          <UserSelectionPopoverTrigger
            disabled={disabled}
            isAdding={isAdding}
            queryError={usersQueryError}
          />
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start" side="bottom">
          <Command>
            <CommandInput 
              placeholder="Search users..."
              value={search}
              onValueChange={setSearch}
            />
            <UserSelectionCommandList
              availableUsers={filteredUsers} // Pass locally filtered users
              isLoading={isLoadingUsers}
              isAdding={isAdding}
              queryError={usersQueryError}
              rawUsersCount={rawUsers.length}
              onSelectUser={handleSelectUser}
            />
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
