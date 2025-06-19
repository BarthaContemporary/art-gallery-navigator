import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserPresence } from './types';

interface PresenceState {
  onlineUsers: UserPresence[];
  isConnected: boolean;
  error: string | null;
  loading: boolean;
  retryCount: number;
  lastActivity: Date | null;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

export function useEnhancedPresence(currentUserId?: string) {
  const [state, setState] = useState<PresenceState>({
    onlineUsers: [],
    isConnected: false,
    error: null,
    loading: true,
    retryCount: 0,
    lastActivity: new Date(),
  });

  const presenceChannel = useRef<any>(null);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const retryTimeout = useRef<NodeJS.Timeout | null>(null);
  const visibilityListener = useRef<(() => void) | null>(null);
  const beforeUnloadListener = useRef<((event: BeforeUnloadEvent) => void) | null>(null);
  const activityListeners = useRef<(() => void)[]>([]);

  const retryConfig: RetryConfig = {
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 30000,
  };

  // Calculate exponential backoff delay
  const getRetryDelay = useCallback((retryCount: number): number => {
    const delay = retryConfig.baseDelay * Math.pow(2, retryCount);
    return Math.min(delay, retryConfig.maxDelay);
  }, [retryConfig]);

  // Enhanced fetch function with retry logic
  const fetchOnlineUsers = useCallback(async (retryCount = 0): Promise<void> => {
    try {
      console.log('Fetching online users... (attempt', retryCount + 1, ')');
      
      const { data, error } = await supabase
        .from('user_presence')
        .select('*');

      if (error) {
        throw new Error(error.message);
      }

      if (!data || data.length === 0) {
        setState(prev => ({ 
          ...prev, 
          onlineUsers: [], 
          loading: false, 
          error: null,
          retryCount: 0 
        }));
        return;
      }

      // Filter out current user and calculate sophisticated status
      const filteredData = data.filter(item => item.user_id !== currentUserId);

      if (filteredData.length === 0) {
        setState(prev => ({ 
          ...prev, 
          onlineUsers: [], 
          loading: false, 
          error: null,
          retryCount: 0 
        }));
        return;
      }

      // Fetch profiles for users
      const userIds = filteredData.map(item => item.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      // Transform data with profiles and calculate sophisticated status
      const transformedData = filteredData.map(item => {
        const profile = (profilesData || []).find(p => p.id === item.user_id);
        const lastSeen = new Date(item.last_seen);
        const now = new Date();
        const minutesSinceLastSeen = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60));
        
        // Sophisticated status calculation
        let isActuallyOnline = item.is_online;
        
        // Consider user offline if last seen > 5 minutes ago, even if marked online
        if (minutesSinceLastSeen > 5) {
          isActuallyOnline = false;
        }
        
        return {
          ...item,
          is_online: isActuallyOnline,
          profile: profile ? {
            display_name: profile.display_name || 'Unknown User',
            avatar_url: profile.avatar_url
          } : { display_name: 'Unknown User' }
        };
      }).filter(item => item.is_online); // Only show actually online users

      console.log('Online users updated:', transformedData.length);
      setState(prev => ({ 
        ...prev, 
        onlineUsers: transformedData, 
        loading: false, 
        error: null,
        retryCount: 0 
      }));

    } catch (error) {
      console.error('Error in fetchOnlineUsers:', error);
      
      if (retryCount < retryConfig.maxRetries) {
        const delay = getRetryDelay(retryCount);
        console.log(`Retrying in ${delay}ms... (${retryCount + 1}/${retryConfig.maxRetries})`);
        
        setState(prev => ({ 
          ...prev, 
          error: `Connection failed, retrying... (${retryCount + 1}/${retryConfig.maxRetries})`,
          retryCount: retryCount + 1
        }));

        retryTimeout.current = setTimeout(() => {
          fetchOnlineUsers(retryCount + 1);
        }, delay);
      } else {
        setState(prev => ({ 
          ...prev, 
          error: 'Failed to fetch online users after multiple attempts', 
          loading: false,
          retryCount: retryConfig.maxRetries
        }));
      }
    }
  }, [currentUserId, retryConfig.maxRetries, getRetryDelay]);

  // Update user presence status with retry logic
  const updatePresence = useCallback(async (isOnline: boolean, retryCount = 0): Promise<void> => {
    if (!currentUserId) return;

    try {
      console.log(`Updating presence to ${isOnline ? 'online' : 'offline'} for user:`, currentUserId);
      
      const { error } = await supabase
        .from('user_presence')
        .upsert({
          user_id: currentUserId,
          is_online: isOnline,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) {
        throw new Error(error.message);
      }

      // Update last activity if going online
      if (isOnline) {
        setState(prev => ({ ...prev, lastActivity: new Date() }));
      }

    } catch (error) {
      console.error('Error in updatePresence:', error);
      
      if (retryCount < retryConfig.maxRetries) {
        const delay = getRetryDelay(retryCount);
        console.log(`Retrying presence update in ${delay}ms...`);
        
        retryTimeout.current = setTimeout(() => {
          updatePresence(isOnline, retryCount + 1);
        }, delay);
      } else {
        setState(prev => ({ 
          ...prev, 
          error: 'Failed to update presence after multiple attempts' 
        }));
      }
    }
  }, [currentUserId, retryConfig.maxRetries, getRetryDelay]);

  // Setup real-time subscription with retry logic
  const setupRealtimeSubscription = useCallback(() => {
    if (!currentUserId) return;

    console.log('Setting up real-time subscription for presence');

    presenceChannel.current = supabase
      .channel('user_presence_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_presence'
      }, (payload) => {
        console.log('Real-time presence update:', payload);
        fetchOnlineUsers();
      })
      .subscribe((status) => {
        console.log('Presence subscription status:', status);
        setState(prev => ({ ...prev, isConnected: status === 'SUBSCRIBED' }));
        
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Retry subscription after delay
          setTimeout(() => {
            setupRealtimeSubscription();
          }, getRetryDelay(state.retryCount));
        }
      });
  }, [currentUserId, fetchOnlineUsers, getRetryDelay, state.retryCount]);

  // Setup heartbeat with activity consideration
  const setupHeartbeat = useCallback(() => {
    if (!currentUserId) return;

    heartbeatInterval.current = setInterval(() => {
      // Only update if tab is visible and user was recently active
      if (document.visibilityState === 'visible') {
        const now = new Date();
        const lastActivity = state.lastActivity || new Date();
        const minutesSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60));
        
        // Consider user active if last activity was within 10 minutes
        if (minutesSinceActivity < 10) {
          updatePresence(true);
        } else {
          // User hasn't been active, set to offline
          updatePresence(false);
        }
      }
    }, 30000); // Check every 30 seconds
  }, [currentUserId, updatePresence, state.lastActivity]);

  // Track user activity
  const trackActivity = useCallback(() => {
    setState(prev => ({ ...prev, lastActivity: new Date() }));
  }, []);

  // Setup activity listeners
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

  // Throttle function
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

  // Setup visibility change listener with immediate updates
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

  // Setup beforeunload listener with proper cleanup
  const setupBeforeUnloadListener = useCallback(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (currentUserId) {
        // Use sendBeacon for reliable offline status update
        const payload = JSON.stringify({
          user_id: currentUserId,
          is_online: false,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // Try sendBeacon first, fallback to fetch with keepalive
        if (navigator.sendBeacon) {
          const url = 'https://cvhdspyugfcvkrufqzrq.supabase.co/rest/v1/user_presence';
          const headers = {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2aGRzcHl1Z2ZjdmtydWZxenJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5ODkxOTIsImV4cCI6MjA2MDU2NTE5Mn0.NT2RKvxlHAuzTDXg9u2K4zq65dNnqfnKTxjpeMDeN6Y',
            'Prefer': 'resolution=merge-duplicates'
          };
          
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon(url, blob);
        } else {
          // Fallback to fetch with keepalive
          fetch('https://cvhdspyugfcvkrufqzrq.supabase.co/rest/v1/user_presence', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2aGRzcHl1Z2ZjdmtydWZxenJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5ODkxOTIsImV4cCI6MjA2MDU2NTE5Mn0.NT2RKvxlHAuzTDXg9u2K4zq65dNnqfnKTxjpeMDeN6Y',
              'Prefer': 'resolution=merge-duplicates'
            },
            body: payload,
            keepalive: true
          }).catch(console.error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    beforeUnloadListener.current = handleBeforeUnload;
  }, [currentUserId]);

  // Comprehensive cleanup function
  const cleanup = useCallback(() => {
    console.log('Cleaning up enhanced presence hooks');

    // Clear all timeouts and intervals
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
    }

    if (retryTimeout.current) {
      clearTimeout(retryTimeout.current);
      retryTimeout.current = null;
    }

    // Remove all event listeners
    if (visibilityListener.current) {
      visibilityListener.current();
      visibilityListener.current = null;
    }

    if (beforeUnloadListener.current) {
      window.removeEventListener('beforeunload', beforeUnloadListener.current);
      beforeUnloadListener.current = null;
    }

    // Clean up activity listeners
    activityListeners.current.forEach(cleanup => cleanup());
    activityListeners.current = [];

    // Clean up real-time subscription
    if (presenceChannel.current) {
      supabase.removeChannel(presenceChannel.current);
      presenceChannel.current = null;
    }

    // Set user offline with final update
    if (currentUserId) {
      updatePresence(false);
    }
  }, [currentUserId, updatePresence]);

  // Initialize enhanced presence system
  useEffect(() => {
    if (!currentUserId) {
      fetchOnlineUsers();
      return;
    }

    console.log('Initializing enhanced presence system for user:', currentUserId);

    // Set user online initially and track activity
    updatePresence(true);
    trackActivity();

    // Setup all listeners and subscriptions
    setupRealtimeSubscription();
    setupHeartbeat();
    setupVisibilityListener();
    setupBeforeUnloadListener();
    setupActivityListeners();

    // Fetch initial data
    fetchOnlineUsers();

    // Cleanup on unmount
    return cleanup;
  }, [
    currentUserId, 
    updatePresence, 
    setupRealtimeSubscription, 
    setupHeartbeat, 
    setupVisibilityListener, 
    setupBeforeUnloadListener,
    setupActivityListeners,
    fetchOnlineUsers, 
    cleanup,
    trackActivity
  ]);

  return {
    onlineUsers: state.onlineUsers,
    isConnected: state.isConnected,
    error: state.error,
    loading: state.loading,
    retryCount: state.retryCount,
    lastActivity: state.lastActivity,
    fetchOnlineUsers: () => fetchOnlineUsers(),
    updatePresence: (isOnline: boolean) => updatePresence(isOnline),
  };
}
