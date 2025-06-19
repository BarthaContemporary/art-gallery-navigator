
import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserPresence } from './types';

export function useOptimizedPresenceUpdater(currentUserId?: string) {
  const lastFetchTime = useRef<number>(0);
  const cachedUsers = useRef<UserPresence[]>([]);
  const updateInProgress = useRef<boolean>(false);
  
  // Cache duration: 2 minutes
  const CACHE_DURATION = 2 * 60 * 1000;
  
  const fetchOnlineUsers = useCallback(async (forceRefresh = false): Promise<UserPresence[]> => {
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
        throw new Error(error.message);
      }

      if (!data || data.length === 0) {
        cachedUsers.current = [];
        lastFetchTime.current = now;
        return [];
      }

      // Filter out current user and get user IDs
      const filteredData = data.filter(item => item.user_id !== currentUserId);
      if (filteredData.length === 0) {
        cachedUsers.current = [];
        lastFetchTime.current = now;
        return [];
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

      // Transform and filter data efficiently
      const now = new Date();
      const transformedData = filteredData
        .map(item => {
          const profile = (profilesData || []).find(p => p.id === item.user_id);
          const lastSeen = new Date(item.last_seen);
          const minutesSinceLastSeen = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60));
          
          // Sophisticated status calculation
          const isActuallyOnline = item.is_online && minutesSinceLastSeen <= 5;
          
          return {
            ...item,
            is_online: isActuallyOnline,
            profile: profile ? {
              display_name: profile.display_name || 'Unknown User',
              avatar_url: profile.avatar_url
            } : { display_name: 'Unknown User' }
          };
        })
        .filter(item => item.is_online); // Only return actually online users

      // Update cache
      cachedUsers.current = transformedData;
      lastFetchTime.current = now;
      
      console.log('Online users updated:', transformedData.length);
      return transformedData;
    } catch (error) {
      console.error('Error fetching online users:', error);
      // Return cached data on error if available
      return cachedUsers.current;
    }
  }, [currentUserId]);

  const updatePresence = useCallback(async (isOnline: boolean): Promise<void> => {
    if (!currentUserId || updateInProgress.current) return;

    updateInProgress.current = true;
    
    try {
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
    } finally {
      updateInProgress.current = false;
    }
  }, [currentUserId]);

  const clearCache = useCallback(() => {
    lastFetchTime.current = 0;
    cachedUsers.current = [];
  }, []);

  return {
    fetchOnlineUsers,
    updatePresence,
    clearCache
  };
}
