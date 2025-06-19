
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserPresence } from './types';

export function usePresenceUpdater(currentUserId?: string) {
  
  const fetchOnlineUsers = useCallback(async (retryCount = 0): Promise<UserPresence[]> => {
    console.log('Fetching online users... (attempt', retryCount + 1, ')');
    
    const { data, error } = await supabase
      .from('user_presence')
      .select('*');

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Filter out current user and calculate sophisticated status
    const filteredData = data.filter(item => item.user_id !== currentUserId);

    if (filteredData.length === 0) {
      return [];
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
    return transformedData;
  }, [currentUserId]);

  const updatePresence = useCallback(async (isOnline: boolean): Promise<void> => {
    if (!currentUserId) return;

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
  }, [currentUserId]);

  return {
    fetchOnlineUsers,
    updatePresence
  };
}
