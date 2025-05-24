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
  disabled?: boolean; // Prop from parent
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
    availableUsers: hookAvailableUsers,
    isLoadingUsers, 
    usersQueryError 
  } = useUserSelectionData(open, disabled, members);

  // Log critical states on every render
  console.log("UserSelectionField Render State:", {
    parentDisabled: disabled,
    isAdding,
    isLoadingUsers,
    usersQueryError,
    rawUsersCount: rawUsers?.length,
    hookAvailableUsersCount: hookAvailableUsers?.length, // Users available before search (raw - members)
    open,
    search,
    debouncedSearch,
  });

  // Simpler useEffect to track 'open' state changes
  useEffect(() => {
    console.log(`UserSelectionField: 'open' state changed to: ${open}`);
    if (open) {
      console.log("UserSelectionField: Popover is now programmatically set to open.");
    } else {
      console.log("UserSelectionField: Popover is now programmatically set to closed.");
    }
  }, [open]);

  // Filter hookAvailableUsers based on debouncedSearch term locally
  const filteredUsers = useMemo(() => {
    if (!Array.isArray(hookAvailableUsers)) return [];
    return hookAvailableUsers.filter(user => {
      const displayName = user.display_name || "";
      const email = user.email || "";
      return displayName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
             email.toLowerCase().includes(debouncedSearch.toLowerCase());
    });
  }, [hookAvailableUsers, debouncedSearch]);

  // Existing detailed useEffect (changed log message slightly for clarity)
  useEffect(() => {
    if (open) {
      console.log("UserSelectionField: DETAILED Debug Info on Popover State", {
        isOpenState: open,
        isLoadingUsers,
        usersQueryError,
        rawUsersCount: rawUsers?.length,
        currentMembersCount: members?.length,
        hookAvailableUsersCount: hookAvailableUsers?.length,
        search, 
        debouncedSearch, 
        filteredUsersForDisplayCount: filteredUsers?.length, 
      });
    }
  }, [open, isLoadingUsers, usersQueryError, rawUsers, members, hookAvailableUsers, search, debouncedSearch, filteredUsers]);

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

  const noUsersInSystem = !isLoadingUsers && !usersQueryError && rawUsers?.length === 0;
  const noUsersAvailableToAdd = !isLoadingUsers && !usersQueryError && (rawUsers?.length ?? 0) > 0 && (hookAvailableUsers?.length ?? 0) === 0;

  const effectiveDisabled = 
    disabled || 
    isAdding || 
    usersQueryError || 
    noUsersInSystem || 
    noUsersAvailableToAdd;
  
  // ADDED: Log the final calculated effectiveDisabled value just before rendering
  console.log("UserSelectionField: Final effectiveDisabled calculation for render:", {
    parentDisabledProp: disabled,
    isAdding,
    usersQueryError,
    noUsersInSystem,
    noUsersAvailableToAdd,
    calculatedEffectiveDisabled: effectiveDisabled,
    rawUsersCount: rawUsers?.length,
    hookAvailableUsersCount: hookAvailableUsers?.length
  });
  
  const popoverContentDescriptionId = "user-selection-popover-description";

  return (
    <div>
      <Popover open={open} onOpenChange={(isOpenValue) => {
        console.log(`UserSelectionField: Popover onOpenChange triggered. isOpenValue: ${isOpenValue}`);
        setOpen(isOpenValue);
        if (!isOpenValue) setSearch(""); 
      }}>
        <PopoverTrigger asChild>
          <UserSelectionPopoverTrigger
            disabled={effectiveDisabled}
            isAdding={isAdding}
            queryError={usersQueryError}
            noUsersInSystem={noUsersInSystem}
            noUsersAvailableToAdd={noUsersAvailableToAdd}
            parentDisabled={disabled}
          />
        </PopoverTrigger>
        <PopoverContent 
          className="p-0 w-[300px]" 
          align="start" 
          side="bottom"
          aria-describedby={popoverContentDescriptionId}
        >
          <span id={popoverContentDescriptionId} className="sr-only">
            Select a user to add as a team member. You can search by name or email.
          </span>
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
              rawUsersCount={rawUsers?.length ?? 0}
              preSearchAvailableUsersCount={hookAvailableUsers?.length ?? 0}
              onSelectUser={handleSelectUser}
            />
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
