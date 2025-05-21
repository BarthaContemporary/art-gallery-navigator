
import { useCallback, useState, useRef, useEffect } from "react";

/**
 * Custom hook for safely managing dialog state
 * Prevents UI freezes when opening/closing dialogs
 */
export function useDialog(initialState = false) {
  const [isOpen, setIsOpen] = useState(initialState);
  const isMounted = useRef(true);
  // animationFrameRef is no longer used

  // Handle component unmount cleanup
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Safely open dialog
  const open = useCallback(() => {
    console.log("useDialog: open() called. Current isMounted:", isMounted.current);
    if (isMounted.current) {
      setIsOpen(true);
      console.log("useDialog: isOpen set to true");
    }
  }, []);

  // Safely close dialog
  const close = useCallback(() => {
    console.log("useDialog: close() called. Current isMounted:", isMounted.current);
    if (isMounted.current) {
      setIsOpen(false);
      console.log("useDialog: isOpen set to false");
    }
  }, []);

  // Safely toggle dialog state
  const toggle = useCallback(() => {
    console.log("useDialog: toggle() called. Current isMounted:", isMounted.current);
    if (isMounted.current) {
      setIsOpen(prev => {
        console.log(`useDialog: toggling isOpen from ${prev} to ${!prev}`);
        return !prev;
      });
    }
  }, []);
  
  // Safely handle onOpenChange from radix dialogs
  const onOpenChange = useCallback((openState: boolean) => {
    console.log(`useDialog: onOpenChange(${openState}) called. Current isMounted:`, isMounted.current);
    if (isMounted.current) {
      setIsOpen(openState);
      console.log(`useDialog: isOpen set to ${openState}`);
    }
  }, []);

  return {
    isOpen,
    open,
    close,
    toggle,
    onOpenChange
  };
}
