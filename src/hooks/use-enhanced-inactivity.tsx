import { useEffect, useCallback, useState, useRef } from 'react';
import { useAuth } from './use-auth';
import { useUnifiedActivityTracker } from './use-unified-activity-tracker';

// Timeout configurations in milliseconds
const TIMEOUT_CONFIGS = {
  external: 15 * 60 * 1000,   // 15 minutes for external users
  user: 30 * 60 * 1000,       // 30 minutes for regular users
  admin: 60 * 60 * 1000,      // 60 minutes for admins
  artist: 45 * 60 * 1000,     // 45 minutes for artists
} as const;

const WARNING_DURATION = 3 * 60 * 1000; // 3 minutes warning before logout

interface UseEnhancedInactivityOptions {
  onWarning?: () => void;
  onExtendSession?: () => void;
}

export function useEnhancedInactivity(options: UseEnhancedInactivityOptions = {}) {
  const { signOut, user, isExternal, isAdmin, isArtist } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const warningTimeout = useRef<NodeJS.Timeout | null>(null);
  const extendedSession = useRef(false);

  // Determine timeout duration based on user role
  const getTimeoutDuration = useCallback(() => {
    if (isExternal) return TIMEOUT_CONFIGS.external;
    if (isAdmin) return TIMEOUT_CONFIGS.admin;
    if (isArtist) return TIMEOUT_CONFIGS.artist;
    return TIMEOUT_CONFIGS.user;
  }, [isExternal, isAdmin, isArtist]);

  // Handle inactivity warning
  const handleInactivityWarning = useCallback(() => {
    if (!isTabVisible) return; // Don't show warning if tab is not visible
    
    setShowWarning(true);
    options.onWarning?.();
    
    // Set final logout timeout
    warningTimeout.current = setTimeout(() => {
      signOut();
    }, WARNING_DURATION);
  }, [signOut, options, isTabVisible]);

  // Handle final logout
  const handleInactivity = useCallback(() => {
    signOut();
  }, [signOut]);

  // Extend session
  const extendSession = useCallback(() => {
    setShowWarning(false);
    extendedSession.current = true;
    
    if (warningTimeout.current) {
      clearTimeout(warningTimeout.current);
      warningTimeout.current = null;
    }
    
    options.onExtendSession?.();
    
    // Reset the extended session flag after a short delay
    setTimeout(() => {
      extendedSession.current = false;
    }, 1000);
  }, [options]);

  // Handle tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const timeoutDuration = getTimeoutDuration();
  const warningStartTime = timeoutDuration - WARNING_DURATION;

  const { setupActivityListeners, cleanup, trackActivity } = useUnifiedActivityTracker(
    handleInactivity,
    undefined,
    {
      inactivityTimeoutMs: timeoutDuration,
      warningTimeoutMs: warningStartTime,
      debounceMs: 30000, // Reduced from 60 seconds to 30 seconds
      onWarning: handleInactivityWarning,
      pauseWhenHidden: true // Pause timer when tab is not visible
    }
  );

  // Clean up warning timeout on unmount
  useEffect(() => {
    return () => {
      if (warningTimeout.current) {
        clearTimeout(warningTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    if (user) {
      setupActivityListeners();
    }
    return cleanup;
  }, [setupActivityListeners, cleanup, user]);

  return {
    showWarning,
    extendSession,
    trackActivity,
    timeoutDuration,
    warningDuration: WARNING_DURATION,
    isTabVisible
  };
}