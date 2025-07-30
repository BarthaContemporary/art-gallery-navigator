
import { useState, useCallback, useRef, useEffect } from 'react';
import { useDebounce } from './use-debounce';

interface ActivityTrackerConfig {
  inactivityTimeoutMs?: number;
  presenceUpdateIntervalMs?: number;
  debounceMs?: number;
  warningTimeoutMs?: number;
  onWarning?: () => void;
  pauseWhenHidden?: boolean;
}

export function useUnifiedActivityTracker(
  onInactivity?: () => void,
  onActivity?: () => void,
  config: ActivityTrackerConfig = {}
) {
  const {
    inactivityTimeoutMs = 30 * 60 * 1000, // 30 minutes default
    presenceUpdateIntervalMs = 2 * 60 * 1000, // 2 minutes
    debounceMs = 30000, // 30 seconds
    warningTimeoutMs,
    onWarning,
    pauseWhenHidden = false
  } = config;

  const [lastActivity, setLastActivity] = useState<Date>(new Date());
  const [isActive, setIsActive] = useState(true);
  const [isTabVisible, setIsTabVisible] = useState(true);
  
  const inactivityTimeout = useRef<NodeJS.Timeout | null>(null);
  const warningTimeout = useRef<NodeJS.Timeout | null>(null);
  const presenceInterval = useRef<NodeJS.Timeout | null>(null);
  const eventListeners = useRef<(() => void)[]>([]);
  const isSetup = useRef(false);
  const isPaused = useRef(false);

  // Debounce activity updates to reduce frequency
  const debouncedLastActivity = useDebounce(lastActivity, debounceMs);

  const trackActivity = useCallback(() => {
    if (pauseWhenHidden && !isTabVisible) return;
    
    const now = new Date();
    setLastActivity(now);
    setIsActive(true);
    isPaused.current = false;
    
    // Clear existing timeouts
    if (inactivityTimeout.current) {
      clearTimeout(inactivityTimeout.current);
    }
    if (warningTimeout.current) {
      clearTimeout(warningTimeout.current);
    }
    
    // Set warning timeout if configured
    if (warningTimeoutMs && onWarning) {
      warningTimeout.current = setTimeout(() => {
        if (!isPaused.current) {
          onWarning();
        }
      }, warningTimeoutMs);
    }
    
    // Set inactivity timeout
    inactivityTimeout.current = setTimeout(() => {
      if (!isPaused.current) {
        setIsActive(false);
        onInactivity?.();
      }
    }, inactivityTimeoutMs);
  }, [inactivityTimeoutMs, warningTimeoutMs, onInactivity, onWarning, pauseWhenHidden, isTabVisible]);

  // Call onActivity when debounced activity changes
  useEffect(() => {
    if (onActivity && debouncedLastActivity) {
      onActivity();
    }
  }, [debouncedLastActivity, onActivity]);

  const setupActivityListeners = useCallback(() => {
    if (isSetup.current) return;
    isSetup.current = true;

    // Enhanced set of events for better activity detection
    const events = ['mousedown', 'mousemove', 'keydown', 'keypress', 'touchstart', 'scroll', 'click', 'focus', 'input'];
    
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

    const throttledTrackActivity = throttle(trackActivity, 30000); // Once per 30 seconds max
    
    // Handle tab visibility changes
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      setIsTabVisible(visible);
      
      if (pauseWhenHidden) {
        if (!visible) {
          // Pause timers when tab becomes hidden
          isPaused.current = true;
          if (inactivityTimeout.current) {
            clearTimeout(inactivityTimeout.current);
          }
          if (warningTimeout.current) {
            clearTimeout(warningTimeout.current);
          }
        } else {
          // Resume activity tracking when tab becomes visible
          isPaused.current = false;
          trackActivity();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    eventListeners.current.push(() => 
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    );
    
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
  }, [trackActivity, presenceUpdateIntervalMs, onActivity, isActive, pauseWhenHidden]);

  const cleanup = useCallback(() => {
    isSetup.current = false;
    isPaused.current = false;
    
    if (inactivityTimeout.current) {
      clearTimeout(inactivityTimeout.current);
      inactivityTimeout.current = null;
    }
    
    if (warningTimeout.current) {
      clearTimeout(warningTimeout.current);
      warningTimeout.current = null;
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
