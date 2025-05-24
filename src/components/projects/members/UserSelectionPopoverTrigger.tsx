
import React, { useEffect, useRef } from 'react'; // Added useEffect, useRef
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus } from "lucide-react";

interface UserSelectionPopoverTriggerProps {
  disabled: boolean; // Master disable from UserSelectionField (this is effectiveDisabled)
  isAdding: boolean;
  queryError: boolean;
  noUsersInSystem?: boolean;
  noUsersAvailableToAdd?: boolean;
  parentDisabled?: boolean; // Was the disabling due to parent prop
  onClick: () => void; // Added onClick prop
}

export function UserSelectionPopoverTrigger({
  disabled,
  isAdding,
  queryError,
  noUsersInSystem,
  noUsersAvailableToAdd,
  parentDisabled,
  onClick, // Destructure onClick
}: UserSelectionPopoverTriggerProps) {
  const buttonRef = useRef<HTMLButtonElement>(null); // Ref for the button
  
  console.log("UserSelectionPopoverTrigger Props:", { 
    effectiveDisabledFromParent: disabled,
    isAdding, 
    queryError, 
    noUsersInSystem, 
    noUsersAvailableToAdd,
    parentDisabledProp: parentDisabled 
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
    title = "Cannot add team member at this time.";
  } else if (isAdding) {
    title = "Adding member...";
  }

  const finalButtonDisabledState = disabled || isAdding;
  console.log("UserSelectionPopoverTrigger: Final button 'disabled' prop calculation:", {
    receivedEffectiveDisabled: disabled,
    receivedIsAdding: isAdding,
    computedButtonDisabledProp: finalButtonDisabledState,
  });

  useEffect(() => {
    if (buttonRef.current) {
      console.log("UserSelectionPopoverTrigger DOM Check:", {
        buttonIsActuallyDisabled_via_JS: buttonRef.current.disabled,
        buttonPointerEvents_via_getComputedStyle: getComputedStyle(buttonRef.current).pointerEvents,
        buttonTitle_via_JS: buttonRef.current.title,
      });
    }
  }, [finalButtonDisabledState, title]); // Re-run if disabled state or title changes

  const borderColorClass = finalButtonDisabledState ? 'border-red-500' : 'border-green-500';

  return (
    <Button
      ref={buttonRef} // Assign ref
      variant="outline"
      size="sm"
      className={`flex items-center gap-1 w-full justify-start border-2 ${borderColorClass}`} // Added border-2 and borderColorClass
      disabled={finalButtonDisabledState}
      title={title}
      onClick={onClick} // Use the passed onClick for the button
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
