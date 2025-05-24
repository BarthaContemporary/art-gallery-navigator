import { Button } from "@/components/ui/button";
import { Loader2, UserPlus } from "lucide-react";

interface UserSelectionPopoverTriggerProps {
  disabled: boolean; // Master disable from UserSelectionField
  isAdding: boolean;
  queryError: boolean;
  noUsersInSystem?: boolean;
  noUsersAvailableToAdd?: boolean;
  parentDisabled?: boolean; // Was the disabling due to parent prop
}

export function UserSelectionPopoverTrigger({
  disabled,
  isAdding,
  queryError,
  noUsersInSystem,
  noUsersAvailableToAdd,
  parentDisabled,
}: UserSelectionPopoverTriggerProps) {
  
  console.log("UserSelectionPopoverTrigger Props:", { 
    disabled, 
    isAdding, 
    queryError, 
    noUsersInSystem, 
    noUsersAvailableToAdd,
    parentDisabled 
  });

  let title = "Add Team Member";
  if (parentDisabled) {
    title = "Adding members is currently disabled for this item.";
  } else if (queryError) {
    title = "Error loading users list. Please try again later.";
  } else if (noUsersInSystem) {
    title = "No users in the system to add.";
  } else if (noUsersAvailableToAdd) {
    title = "All eligible users have already been added.";
  } else if (disabled && !isAdding) { 
    // This case might be redundant if `disabled` logic in UserSelectionField covers all scenarios
    // leading to `disabled` being true. Keeping as a fallback.
    title = "Cannot add team member at this time.";
  } else if (isAdding) {
    title = "Adding member...";
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="flex items-center gap-1 w-full justify-start"
      disabled={disabled || isAdding} // Main disable + isAdding for spinner interaction
      title={title}
      // onClick removed, Radix PopoverTrigger will handle it
    >
      {isAdding ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <UserPlus className="h-4 w-4 mr-2" />
      )}
      Add Team Member
    </Button>
  );
}
