
import { useCallback, useState, useRef, useEffect } from "react";

/**
 * Custom hook for safely managing dialog state
 * Prevents UI freezes when opening/closing dialogs
 */
export function useDialog(initialState = false) {
  const [isOpen, setIsOpen] = useState(initialState);
  const isMounted = useRef(true);
  const animationFrameRef = useRef<number | null>(null);

  // Handle component unmount cleanup
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Safely open dialog with animation frame
  const open = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      if (isMounted.current) {
        setIsOpen(true);
      }
    });
  }, []);

  // Safely close dialog with animation frame
  const close = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      if (isMounted.current) {
        setIsOpen(false);
      }
    });
  }, []);

  // Safely toggle dialog state with animation frame
  const toggle = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      if (isMounted.current) {
        setIsOpen(prev => !prev);
      }
    });
  }, []);
  
  // Safely handle onOpenChange from radix dialogs
  const onOpenChange = useCallback((open: boolean) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Use nested requestAnimationFrame for smoother transitions
    animationFrameRef.current = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (isMounted.current) {
          setIsOpen(open);
        }
      });
    });
  }, []);

  return {
    isOpen,
    open,
    close,
    toggle,
    onOpenChange
  };
}
