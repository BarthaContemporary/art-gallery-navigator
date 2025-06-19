
import { useState, useEffect, useCallback } from 'react';
import { PresenceState } from './presence/types';
import { useRetryManager } from './presence/retry-manager';
import { useActivityTracker } from './presence/activity-tracker';
import { useCleanupManager } from './presence/cleanup-manager';
import { usePresenceUpdater } from './presence/presence-updater';
import { useRealtimeManager } from './presence/realtime-manager';
import { useLifecycleManager } from './presence/lifecycle-manager';

export function useEnhancedPresence(currentUserId?: string) {
  const [state, setState] = useState<PresenceState>({
    onlineUsers: [],
    isConnected: false,
    error: null,
    loading: true,
    retryCount: 0,
    lastActivity: new Date(),
  });

  // Initialize all managers
  const { retryConfig, scheduleRetry, clearRetryTimeout } = useRetryManager();
  const { lastActivity, trackActivity, setupActivityListeners, cleanupActivityListeners } = useActivityTracker();
  const { setupBeforeUnloadListener, cleanupBeforeUnloadListener } = useCleanupManager(currentUserId);
  const { fetchOnlineUsers: fetchUsersCore, updatePresence: updatePresenceCore } = usePresenceUpdater(currentUserId);

  // Enhanced fetch function with retry logic
  const fetchOnlineUsers = useCallback(async (retryCount = 0): Promise<void> => {
    try {
      const users = await fetchUsersCore(retryCount);
      setState(prev => ({ 
        ...prev, 
        onlineUsers: users, 
        loading: false, 
        error: null,
        retryCount: 0 
      }));
    } catch (error) {
      console.error('Error in fetchOnlineUsers:', error);
      
      if (retryCount < retryConfig.maxRetries) {
        setState(prev => ({ 
          ...prev, 
          error: `Connection failed, retrying... (${retryCount + 1}/${retryConfig.maxRetries})`,
          retryCount: retryCount + 1
        }));

        scheduleRetry(() => {
          fetchOnlineUsers(retryCount + 1);
        }, retryCount);
      } else {
        setState(prev => ({ 
          ...prev, 
          error: 'Failed to fetch online users after multiple attempts', 
          loading: false,
          retryCount: retryConfig.maxRetries
        }));
      }
    }
  }, [fetchUsersCore, retryConfig.maxRetries, scheduleRetry]);

  // Update user presence status with retry logic
  const updatePresence = useCallback(async (isOnline: boolean, retryCount = 0): Promise<void> => {
    if (!currentUserId) return;

    try {
      await updatePresenceCore(isOnline);
      
      // Update last activity if going online
      if (isOnline) {
        setState(prev => ({ ...prev, lastActivity: new Date() }));
      }
    } catch (error) {
      console.error('Error in updatePresence:', error);
      
      if (retryCount < retryConfig.maxRetries) {
        scheduleRetry(() => {
          updatePresence(isOnline, retryCount + 1);
        }, retryCount);
      } else {
        setState(prev => ({ 
          ...prev, 
          error: 'Failed to update presence after multiple attempts' 
        }));
      }
    }
  }, [currentUserId, updatePresenceCore, retryConfig.maxRetries, scheduleRetry]);

  // Setup real-time subscription
  const { setupRealtimeSubscription, cleanupRealtimeSubscription } = useRealtimeManager(
    currentUserId, 
    () => fetchOnlineUsers()
  );

  // Setup lifecycle management
  const { 
    setupHeartbeat, 
    setupVisibilityListener, 
    cleanupHeartbeat, 
    cleanupVisibilityListener 
  } = useLifecycleManager(updatePresence, () => fetchOnlineUsers(), trackActivity, lastActivity);

  // Comprehensive cleanup function
  const cleanup = useCallback(() => {
    console.log('Cleaning up enhanced presence hooks');

    clearRetryTimeout();
    cleanupHeartbeat();
    cleanupVisibilityListener();
    cleanupBeforeUnloadListener();
    cleanupActivityListeners();
    cleanupRealtimeSubscription();

    // Set user offline with final update
    if (currentUserId) {
      updatePresence(false);
    }
  }, [
    currentUserId, 
    updatePresence, 
    clearRetryTimeout,
    cleanupHeartbeat,
    cleanupVisibilityListener,
    cleanupBeforeUnloadListener,
    cleanupActivityListeners,
    cleanupRealtimeSubscription
  ]);

  // Update state with latest activity
  useEffect(() => {
    setState(prev => ({ ...prev, lastActivity }));
  }, [lastActivity]);

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
