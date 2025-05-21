import { useState, useEffect, useMemo } from "react";
import { Command, CommandInput } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { ProjectMember } from "@/hooks/projects";
import { useUserSelectionData, UserData } from "./hooks/use-user-selection-data";
import { UserSelectionCommandList } from "./UserSelectionCommandList";
import { UserSelectionPopoverTrigger } from "./UserSelectionPopoverTrigger";
import { useDebounce } from "@/hooks/use-debounce";

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
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { 
    rawUsers,
    availableUsers, 
    isLoadingUsers, 
    usersQueryError 
  } = useUserSelectionData(open, disabled, members);

  // Simpler useEffect to track 'open' state changes
  useEffect(() => {
    console.log(`UserSelectionField: 'open' state changed to: ${open}`);
    if (open) {
      console.log("UserSelectionField: Popover is now programmatically set to open.");
    } else {
      console.log("UserSelectionField: Popover is now programmatically set to closed.");
    }
  }, [open]);

  // Filter availableUsers based on debouncedSearch term locally
  const filteredUsers = useMemo(() => {
    return availableUsers.filter(user => {
      const displayName = user.display_name || "";
      const email = user.email || "";
      return displayName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
             email.toLowerCase().includes(debouncedSearch.toLowerCase());
    });
  }, [availableUsers, debouncedSearch]);


  // Existing detailed useEffect (changed log message slightly for clarity)
  useEffect(() => {
    if (open) {
      console.log("UserSelectionField: DETAILED Debug Info on Popover State", {
        isOpenState: open,
        isLoadingUsers,
        usersQueryError,
        rawUsersCount: rawUsers?.length,
        currentMembersCount: members?.length,
        availableUsersFromHookCount: availableUsers?.length,
        search, 
        debouncedSearch, 
        filteredUsersForDisplayCount: filteredUsers?.length, 
      });
    }
  }, [open, isLoadingUsers, usersQueryError, rawUsers, members, availableUsers, search, debouncedSearch, filteredUsers]);

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
      <Popover open={open} onOpenChange={(isOpenValue) => {
        console.log(`UserSelectionField: Popover onOpenChange triggered. isOpenValue: ${isOpenValue}`);
        setOpen(isOpenValue);
        if (!isOpenValue) setSearch(""); 
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
              availableUsers={filteredUsers} 
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
