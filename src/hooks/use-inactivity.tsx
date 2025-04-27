
import { useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';

const TIMEOUT_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

export function useInactivity() {
  const { signOut } = useAuth();

  const resetTimer = useCallback(() => {
    const existingTimeout = window.localStorage.getItem('inactivityTimeout');
    if (existingTimeout) {
      window.clearTimeout(parseInt(existingTimeout));
    }

    const newTimeout = window.setTimeout(() => {
      signOut();
    }, TIMEOUT_DURATION);

    window.localStorage.setItem('inactivityTimeout', newTimeout.toString());
  }, [signOut]);

  useEffect(() => {
    // Reset timer on any user activity
    const activities = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    
    activities.forEach(activity => {
      window.addEventListener(activity, resetTimer);
    });

    // Initial timer setup
    resetTimer();

    // Cleanup
    return () => {
      const existingTimeout = window.localStorage.getItem('inactivityTimeout');
      if (existingTimeout) {
        window.clearTimeout(parseInt(existingTimeout));
      }
      activities.forEach(activity => {
        window.removeEventListener(activity, resetTimer);
      });
    };
  }, [resetTimer]);
}
