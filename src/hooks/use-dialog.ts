
import { useCallback, useState } from "react";

/**
 * Custom hook for safely managing dialog state
 * Prevents UI freezes when opening/closing dialogs
 */
export function useDialog(initialState = false) {
  const [isOpen, setIsOpen] = useState(initialState);

  // Safely open dialog
  const open = useCallback(() => {
    console.log("useDialog: open() called. Setting isOpen to true.");
    setIsOpen(true);
  }, []);

  // Safely close dialog
  const close = useCallback(() => {
    console.log("useDialog: close() called. Setting isOpen to false.");
    setIsOpen(false);
  }, []);

  // Safely toggle dialog state
  const toggle = useCallback(() => {
    setIsOpen(prev => {
      console.log(`useDialog: toggle() called. Toggling isOpen from ${prev} to ${!prev}.`);
      return !prev;
    });
  }, []);
  
  // Safely handle onOpenChange from radix dialogs
  const onOpenChange = useCallback((openState: boolean) => {
    console.log(`useDialog: onOpenChange(${openState}) called. Setting isOpen to ${openState}.`);
    setIsOpen(openState);
  }, []);

  return {
    isOpen,
    open,
    close,
    toggle,
    onOpenChange
  };
}
