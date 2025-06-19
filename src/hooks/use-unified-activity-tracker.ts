
import { useState, useCallback, useRef, useEffect } from 'react';
import { useDebounce } from './use-debounce';

interface ActivityTrackerConfig {
  inactivityTimeoutMs?: number;
  presenceUpdateIntervalMs?: number;
  debounceMs?: number;
}

export function useUnifiedActivityTracker(
  onInactivity?: () => void,
  onActivity?: () => void,
  config: ActivityTrackerConfig = {}
) {
  const {
    inactivityTimeoutMs = 10 * 60 * 1000, // 10 minutes
    presenceUpdateIntervalMs = 2 * 60 * 1000, // 2 minutes
    debounceMs = 30000 // 30 seconds
  } = config;

  const [lastActivity, setLastActivity] = useState<Date>(new Date());
  const [isActive, setIsActive] = useState(true);
  
  const inactivityTimeout = useRef<NodeJS.Timeout | null>(null);
  const presenceInterval = useRef<NodeJS.Timeout | null>(null);
  const eventListeners = useRef<(() => void)[]>([]);
  const isSetup = useRef(false);

  // Debounce activity updates to reduce frequency
  const debouncedLastActivity = useDebounce(lastActivity, debounceMs);

  const trackActivity = useCallback(() => {
    const now = new Date();
    setLastActivity(now);
    setIsActive(true);
    
    // Reset inactivity timer
    if (inactivityTimeout.current) {
      clearTimeout(inactivityTimeout.current);
    }
    
    inactivityTimeout.current = setTimeout(() => {
      setIsActive(false);
      onInactivity?.();
    }, inactivityTimeoutMs);

    // Call activity callback (debounced through effect)
  }, [inactivityTimeoutMs, onInactivity]);

  // Call onActivity when debounced activity changes
  useEffect(() => {
    if (onActivity && debouncedLastActivity) {
      onActivity();
    }
  }, [debouncedLastActivity, onActivity]);

  const setupActivityListeners = useCallback(() => {
    if (isSetup.current) return;
    isSetup.current = true;

    // Reduced set of events with passive listeners
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    
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

    const throttledTrackActivity = throttle(trackActivity, 60000); // Once per minute max
    
    events.forEach(event => {
      document.addEventListener(event, throttledTrackActivity, { 
        passive: true, 
        capture: false 
      });
      eventListeners.current.push(() => 
        document.removeEventListener(event, throttledTrackActivity)
      );
    });

    // Setup periodic presence updates
    presenceInterval.current = setInterval(() => {
      if (isActive) {
        onActivity?.();
      }
    }, presenceUpdateIntervalMs);

    // Initial activity tracking
    trackActivity();
  }, [trackActivity, presenceUpdateIntervalMs, onActivity, isActive]);

  const cleanup = useCallback(() => {
    isSetup.current = false;
    
    if (inactivityTimeout.current) {
      clearTimeout(inactivityTimeout.current);
      inactivityTimeout.current = null;
    }
    
    if (presenceInterval.current) {
      clearInterval(presenceInterval.current);
      presenceInterval.current = null;
    }
    
    eventListeners.current.forEach(cleanup => cleanup());
    eventListeners.current = [];
  }, []);

  return {
    lastActivity: debouncedLastActivity,
    isActive,
    setupActivityListeners,
    cleanup,
    trackActivity
  };
}
