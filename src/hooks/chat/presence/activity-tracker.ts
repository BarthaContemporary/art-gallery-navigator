
import { useState, useCallback, useRef } from 'react';

export function useActivityTracker() {
  const [lastActivity, setLastActivity] = useState<Date>(new Date());
  const activityListeners = useRef<(() => void)[]>([]);

  const trackActivity = useCallback(() => {
    setLastActivity(new Date());
  }, []);

  const throttle = (func: Function, limit: number) => {
    let inThrottle: boolean;
    return function(this: any, ...args: any[]) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  };

  const setupActivityListeners = useCallback(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const cleanup: (() => void)[] = [];
    
    events.forEach(event => {
      const throttledTrackActivity = throttle(trackActivity, 5000); // Throttle to once per 5 seconds
      document.addEventListener(event, throttledTrackActivity, { passive: true });
      cleanup.push(() => document.removeEventListener(event, throttledTrackActivity));
    });
    
    activityListeners.current = cleanup;
  }, [trackActivity]);

  const cleanupActivityListeners = useCallback(() => {
    activityListeners.current.forEach(cleanup => cleanup());
    activityListeners.current = [];
  }, []);

  return {
    lastActivity,
    trackActivity,
    setupActivityListeners,
    cleanupActivityListeners
  };
}
