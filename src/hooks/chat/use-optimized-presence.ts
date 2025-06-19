
import { useState, useEffect, useCallback, useMemo } from 'react';
import { PresenceState } from './presence/types';
import { useRetryManager } from './presence/retry-manager';
import { useUnifiedActivityTracker } from '../use-unified-activity-tracker';
import { useCleanupManager } from './presence/cleanup-manager';
import { useOptimizedPresenceUpdater } from './presence/optimized-presence-updater';
import { useRealtimeManager } from './presence/realtime-manager';

export function useOptimizedPresence(currentUserId?: string) {
  const [state, setState] = useState<PresenceState>({
    onlineUsers: [],
    isConnected: false,
    error: null,
    loading: true,
    retryCount: 0,
    lastActivity: new Date(),
  });

  // Initialize managers
  const { retryConfig, scheduleRetry, clearRetryTimeout } = useRetryManager();
  const { setupBeforeUnloadListener, cleanupBeforeUnloadListener } = useCleanupManager(currentUserId);
  const { fetchOnlineUsers: fetchUsersCore, updatePresence: updatePresenceCore, clearCache } = useOptimizedPresenceUpdater(currentUserId);

  // Memoized update functions to prevent unnecessary re-renders
  const handleActivity = useCallback(async () => {
    if (!currentUserId) return;
    try {
      await updatePresenceCore(true);
      setState(prev => ({ ...prev, lastActivity: new Date(), error: null }));
    } catch (error) {
      console.error('Error updating presence on activity:', error);
    }
  }, [currentUserId, updatePresenceCore]);

  const handleInactivity = useCallback(async () => {
    if (!currentUserId) return;
    try {
      await updatePresenceCore(false);
    } catch (error) {
      console.error('Error updating presence on inactivity:', error);
    }
  }, [currentUserId, updatePresenceCore]);

  // Unified activity tracking
  const { lastActivity, setupActivityListeners, cleanup: cleanupActivity } = useUnifiedActivityTracker(
    handleInactivity,
    handleActivity,
    {
      inactivityTimeoutMs: 10 * 60 * 1000, // 10 minutes
      presenceUpdateIntervalMs: 3 * 60 * 1000, // 3 minutes (reduced frequency)
      debounceMs: 60000 // 1 minute debounce
    }
  );

  // Enhanced fetch function with retry logic
  const fetchOnlineUsers = useCallback(async (retryCount = 0): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: retryCount === 0 }));
      
      const users = await fetchUsersCore(retryCount > 0);
      setState(prev => ({ 
        ...prev, 
        onlineUsers: users, 
        loading: false, 
        error: null,
        retryCount: 0,
        isConnected: true
      }));
    } catch (error) {
      console.error('Error in fetchOnlineUsers:', error);
      
      if (retryCount < retryConfig.maxRetries) {
        setState(prev => ({ 
          ...prev, 
          error: `Connection failed, retrying... (${retryCount + 1}/${retryConfig.maxRetries})`,
          retryCount: retryCount + 1,
          isConnected: false
        }));

        scheduleRetry(() => {
          fetchOnlineUsers(retryCount + 1);
        }, retryCount);
      } else {
        setState(prev => ({ 
          ...prev, 
          error: 'Failed to fetch online users after multiple attempts', 
          loading: false,
          retryCount: retryConfig.maxRetries,
          isConnected: false
        }));
      }
    }
  }, [fetchUsersCore, retryConfig.maxRetries, scheduleRetry]);

  // Setup real-time subscription with optimized callback
  const optimizedRefresh = useCallback(() => {
    fetchOnlineUsers();
  }, [fetchOnlineUsers]);

  const { setupRealtimeSubscription, cleanupRealtimeSubscription } = useRealtimeManager(
    currentUserId, 
    optimizedRefresh
  );

  // Comprehensive cleanup function
  const cleanup = useCallback(() => {
    console.log('Cleaning up optimized presence hooks');

    clearRetryTimeout();
    cleanupBeforeUnloadListener();
    cleanupActivity();
    cleanupRealtimeSubscription();
    clearCache();

    // Set user offline with final update
    if (currentUserId) {
      updatePresenceCore(false).catch(console.error);
    }
  }, [
    currentUserId, 
    updatePresenceCore, 
    clearRetryTimeout,
    cleanupBeforeUnloadListener,
    cleanupActivity,
    cleanupRealtimeSubscription,
    clearCache
  ]);

  // Update state with latest activity (memoized)
  const memoizedLastActivity = useMemo(() => lastActivity, [lastActivity]);
  useEffect(() => {
    setState(prev => ({ ...prev, lastActivity: memoizedLastActivity }));
  }, [memoizedLastActivity]);

  // Initialize presence system with reduced complexity
  useEffect(() => {
    if (!currentUserId) {
      fetchOnlineUsers();
      return;
    }

    console.log('Initializing optimized presence system for user:', currentUserId);

    // Set user online initially
    updatePresenceCore(true).catch(console.error);

    // Setup all listeners and subscriptions
    setupRealtimeSubscription();
    setupBeforeUnloadListener();
    setupActivityListeners();

    // Fetch initial data
    fetchOnlineUsers();

    // Cleanup on unmount
    return cleanup;
  }, [
    currentUserId, 
    updatePresenceCore, 
    setupRealtimeSubscription, 
    setupBeforeUnloadListener,
    setupActivityListeners,
    fetchOnlineUsers, 
    cleanup
  ]);

  // Memoized return object to prevent unnecessary re-renders
  return useMemo(() => ({
    onlineUsers: state.onlineUsers,
    isConnected: state.isConnected,
    error: state.error,
    loading: state.loading,
    retryCount: state.retryCount,
    lastActivity: state.lastActivity,
    fetchOnlineUsers: () => fetchOnlineUsers(),
    updatePresence: (isOnline: boolean) => updatePresenceCore(isOnline),
  }), [
    state.onlineUsers,
    state.isConnected,
    state.error,
    state.loading,
    state.retryCount,
    state.lastActivity,
    fetchOnlineUsers,
    updatePresenceCore
  ]);
}
