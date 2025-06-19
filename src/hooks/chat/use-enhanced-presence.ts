import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserPresence } from './types';

interface PresenceState {
  onlineUsers: UserPresence[];
  isConnected: boolean;
  error: string | null;
  loading: boolean;
}

export function useEnhancedPresence(currentUserId?: string) {
  const [state, setState] = useState<PresenceState>({
    onlineUsers: [],
    isConnected: false,
    error: null,
    loading: true,
  });

  const presenceChannel = useRef<any>(null);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const visibilityListener = useRef<(() => void) | null>(null);
  const beforeUnloadListener = useRef<((event: BeforeUnloadEvent) => void) | null>(null);

  // Enhanced fetch function with better error handling
  const fetchOnlineUsers = useCallback(async () => {
    try {
      console.log('Fetching online users...');
      
      const { data, error } = await supabase
        .from('user_presence')
        .select('*');

      if (error) {
        console.error('Error fetching online users:', error);
        setState(prev => ({ ...prev, error: error.message }));
        return;
      }

      if (!data || data.length === 0) {
        console.log('No online users found');
        setState(prev => ({ ...prev, onlineUsers: [], loading: false }));
        return;
      }

      // Filter out current user and only show actually online users
      const filteredData = data.filter(item => 
        item.user_id !== currentUserId && item.is_online === true
      );

      if (filteredData.length === 0) {
        setState(prev => ({ ...prev, onlineUsers: [], loading: false }));
        return;
      }

      // Fetch profiles for online users
      const userIds = filteredData.map(item => item.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      // Transform data with profiles
      const transformedData = filteredData.map(item => {
        const profile = (profilesData || []).find(p => p.id === item.user_id);
        return {
          ...item,
          profile: profile ? {
            display_name: profile.display_name || 'Unknown User',
            avatar_url: profile.avatar_url
          } : { display_name: 'Unknown User' }
        };
      });

      console.log('Online users updated:', transformedData.length);
      setState(prev => ({ 
        ...prev, 
        onlineUsers: transformedData, 
        loading: false, 
        error: null 
      }));

    } catch (error) {
      console.error('Error in fetchOnlineUsers:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to fetch online users', 
        loading: false 
      }));
    }
  }, [currentUserId]);

  // Update user presence status
  const updatePresence = useCallback(async (isOnline: boolean) => {
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
        console.error('Error updating presence:', error);
        setState(prev => ({ ...prev, error: error.message }));
      }
    } catch (error) {
      console.error('Error in updatePresence:', error);
    }
  }, [currentUserId]);

  // Setup real-time subscription
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
      });
  }, [currentUserId, fetchOnlineUsers]);

  // Setup heartbeat to keep user online
  const setupHeartbeat = useCallback(() => {
    if (!currentUserId) return;

    heartbeatInterval.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updatePresence(true);
      }
    }, 30000); // Update every 30 seconds
  }, [currentUserId, updatePresence]);

  // Setup visibility change listener
  const setupVisibilityListener = useCallback(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible - setting user online');
        updatePresence(true);
        fetchOnlineUsers();
      } else {
        console.log('Tab became hidden - setting user offline');
        updatePresence(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    visibilityListener.current = () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [updatePresence, fetchOnlineUsers]);

  // Setup beforeunload listener
  const setupBeforeUnloadListener = useCallback(() => {
    const handleBeforeUnload = () => {
      if (currentUserId) {
        // Use sendBeacon for reliable offline status update
        navigator.sendBeacon(`${supabase.supabaseUrl}/rest/v1/user_presence`, 
          JSON.stringify({
            user_id: currentUserId,
            is_online: false,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    beforeUnloadListener.current = () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUserId]);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('Cleaning up presence hooks');

    // Clear heartbeat
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
    }

    // Remove visibility listener
    if (visibilityListener.current) {
      visibilityListener.current();
      visibilityListener.current = null;
    }

    // Remove beforeunload listener
    if (beforeUnloadListener.current) {
      beforeUnloadListener.current();
      beforeUnloadListener.current = null;
    }

    // Clean up real-time subscription
    if (presenceChannel.current) {
      supabase.removeChannel(presenceChannel.current);
      presenceChannel.current = null;
    }

    // Set user offline
    if (currentUserId) {
      updatePresence(false);
    }
  }, [currentUserId, updatePresence]);

  // Initialize presence system
  useEffect(() => {
    if (!currentUserId) {
      // Still fetch online users even without current user
      fetchOnlineUsers();
      return;
    }

    console.log('Initializing enhanced presence system for user:', currentUserId);

    // Set user online initially
    updatePresence(true);

    // Setup all listeners and subscriptions
    setupRealtimeSubscription();
    setupHeartbeat();
    setupVisibilityListener();
    setupBeforeUnloadListener();

    // Fetch initial data
    fetchOnlineUsers();

    // Cleanup on unmount
    return cleanup;
  }, [currentUserId, updatePresence, setupRealtimeSubscription, setupHeartbeat, setupVisibilityListener, setupBeforeUnloadListener, fetchOnlineUsers, cleanup]);

  return {
    onlineUsers: state.onlineUsers,
    isConnected: state.isConnected,
    error: state.error,
    loading: state.loading,
    fetchOnlineUsers,
    updatePresence,
  };
}
