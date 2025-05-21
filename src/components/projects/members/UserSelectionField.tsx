
import { useState, useEffect } from "react";
import { Command, CommandInput } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { ProjectMember } from "@/hooks/projects";
import { useUserSelectionData, UserData } from "./hooks/use-user-selection-data";
import { UserSelectionCommandList } from "./UserSelectionCommandList";
import { UserSelectionPopoverTrigger } from "./UserSelectionPopoverTrigger";
import { useDebounce } from "@/hooks/use-debounce"; // Import useDebounce

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
  const debouncedSearch = useDebounce(search, 300); // Debounce search term

  const { 
    rawUsers,
    availableUsers, 
    isLoadingUsers, 
    usersQueryError 
  } = useUserSelectionData(open, disabled, members);

  // Filter availableUsers based on debouncedSearch term locally
  const filteredUsers = useMemo(() => {
    // console.log("UserSelectionField: Filtering users with debouncedSearch:", debouncedSearch, "Available users for local filter:", availableUsers.length); // Debug log
    return availableUsers.filter(user => {
      const displayName = user.display_name || "";
      const email = user.email || "";
      return displayName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
             email.toLowerCase().includes(debouncedSearch.toLowerCase());
    });
  }, [availableUsers, debouncedSearch]);


  useEffect(() => {
    if (open) {
      console.log("UserSelectionField: Debug Info on Popover Open/Update", {
        isLoadingUsers,
        usersQueryError,
        rawUsersCount: rawUsers?.length,
        currentMembersCount: members?.length,
        availableUsersForSelectionInHookCount: availableUsers?.length, // Users from hook before local search
        search, // current typed search
        debouncedSearch, // debounced search used for filtering
        filteredUsersForDisplayCount: filteredUsers?.length, // Users after local search filter
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
              value={search} // Input still uses immediate search value
              onValueChange={setSearch} // setSearch updates the immediate search value
            />
            <UserSelectionCommandList
              availableUsers={filteredUsers} // Pass locally filtered users based on debouncedSearch
              isLoading={isLoadingUsers}
              isAdding={isAdding}
              queryError={usersQueryError}
              rawUsersCount={rawUsers.length} // Use rawUsers from hook for this count
              onSelectUser={handleSelectUser}
            />
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
