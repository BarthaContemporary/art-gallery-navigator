
import { useRef, useCallback } from 'react';

export function useLifecycleManager(
  updatePresence: (isOnline: boolean) => Promise<void>,
  fetchOnlineUsers: () => void,
  trackActivity: () => void,
  lastActivity: Date | null
) {
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const visibilityListener = useRef<(() => void) | null>(null);

  const setupHeartbeat = useCallback(() => {
    heartbeatInterval.current = setInterval(() => {
      // Only update if tab is visible and user was recently active
      if (document.visibilityState === 'visible') {
        const now = new Date();
        const lastActivityTime = lastActivity || new Date();
        const minutesSinceActivity = Math.floor((now.getTime() - lastActivityTime.getTime()) / (1000 * 60));
        
        // Consider user active if last activity was within 10 minutes
        if (minutesSinceActivity < 10) {
          updatePresence(true);
        } else {
          // User hasn't been active, set to offline
          updatePresence(false);
        }
      }
    }, 30000); // Check every 30 seconds
  }, [updatePresence, lastActivity]);

  const setupVisibilityListener = useCallback(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible - setting user online');
        updatePresence(true);
        fetchOnlineUsers();
        // Track activity when tab becomes visible
        trackActivity();
      } else {
        console.log('Tab became hidden - setting user offline');
        updatePresence(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    visibilityListener.current = () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [updatePresence, fetchOnlineUsers, trackActivity]);

  const cleanupHeartbeat = useCallback(() => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
    }
  }, []);

  const cleanupVisibilityListener = useCallback(() => {
    if (visibilityListener.current) {
      visibilityListener.current();
      visibilityListener.current = null;
    }
  }, []);

  return {
    setupHeartbeat,
    setupVisibilityListener,
    cleanupHeartbeat,
    cleanupVisibilityListener
  };
}
