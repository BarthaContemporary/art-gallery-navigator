
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserPresence } from './types';

export function useOptimizedChatPresence(userId?: string) {
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const [connected, setConnected] = useState(false);
  const presenceChannel = useRef<any>(null);
  const lastFetchTime = useRef<number>(0);
  const cachedUsers = useRef<UserPresence[]>([]);
  
  // Cache duration: 30 seconds
  const CACHE_DURATION = 30 * 1000;

  // Debounced fetch function
  const fetchOnlineUsers = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    
    // Return cached data if still valid
    if (!forceRefresh && (now - lastFetchTime.current) < CACHE_DURATION) {
      return cachedUsers.current;
    }

    try {
      const { data, error } = await supabase
        .from('user_presence')
        .select('*');

      if (error) {
        console.error('Error fetching online users:', error);
        return cachedUsers.current;
      }

      if (!data || data.length === 0) {
        const emptyResult: UserPresence[] = [];
        cachedUsers.current = emptyResult;
        setOnlineUsers(emptyResult);
        lastFetchTime.current = now;
        return emptyResult;
      }

      // Filter out current user and check actual online status
      const filteredData = data.filter(item => {
        if (item.user_id === userId) return false;
        
        const lastSeen = new Date(item.last_seen);
        const minutesSinceLastSeen = Math.floor((now - lastSeen.getTime()) / (1000 * 60));
        
        // Consider online if last seen within 5 minutes
        return item.is_online && minutesSinceLastSeen <= 5;
      });

      if (filteredData.length === 0) {
        const emptyResult: UserPresence[] = [];
        cachedUsers.current = emptyResult;
        setOnlineUsers(emptyResult);
        lastFetchTime.current = now;
        return emptyResult;
      }

      // Batch fetch profiles
      const userIds = filteredData.map(item => item.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      // Transform data
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

      // Update cache and state
      cachedUsers.current = transformedData;
      setOnlineUsers(transformedData);
      lastFetchTime.current = now;
      
      console.log('Online users updated:', transformedData.length);
      return transformedData;
    } catch (error) {
      console.error('Error in fetchOnlineUsers:', error);
      return cachedUsers.current;
    }
  }, [userId]);

  // Update current user presence
  const updatePresence = useCallback(async (isOnline: boolean) => {
    if (!userId) return;

    try {
      await supabase
        .from('user_presence')
        .upsert({
          user_id: userId,
          is_online: isOnline,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }, [userId]);

  // Initialize presence tracking
  useEffect(() => {
    if (!userId) {
      fetchOnlineUsers();
      return;
    }

    const initializePresence = async () => {
      // Update user presence to online
      await updatePresence(true);

      // Set up presence channel with reduced frequency
      presenceChannel.current = supabase
        .channel('user_presence')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'user_presence'
        }, () => {
          // Debounce presence updates
          setTimeout(() => fetchOnlineUsers(true), 1000);
        })
        .subscribe((status) => {
          setConnected(status === 'SUBSCRIBED');
        });

      // Initial fetch
      await fetchOnlineUsers(true);
    };

    initializePresence();

    // Periodic refresh (every 2 minutes instead of 30 seconds)
    const interval = setInterval(() => {
      fetchOnlineUsers(true);
    }, 120000);

    // Cleanup on unmount
    return () => {
      clearInterval(interval);
      if (presenceChannel.current) {
        supabase.removeChannel(presenceChannel.current);
        presenceChannel.current = null;
      }
      if (userId) {
        updatePresence(false);
      }
    };
  }, [userId, fetchOnlineUsers, updatePresence]);

  return {
    onlineUsers,
    connected,
    fetchOnlineUsers: () => fetchOnlineUsers(true),
  };
}
