
import { useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';
import { useUnifiedActivityTracker } from './use-unified-activity-tracker';

const TIMEOUT_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

export function useInactivity() {
  const { signOut } = useAuth();

  const handleInactivity = useCallback(() => {
    signOut();
  }, [signOut]);

  const { setupActivityListeners, cleanup } = useUnifiedActivityTracker(
    handleInactivity,
    undefined,
    {
      inactivityTimeoutMs: TIMEOUT_DURATION,
      debounceMs: 60000 // 1 minute debounce
    }
  );

  useEffect(() => {
    setupActivityListeners();
    return cleanup;
  }, [setupActivityListeners, cleanup]);
}
