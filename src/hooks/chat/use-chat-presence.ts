
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserPresence } from './types';

export function useChatPresence(userId?: string) {
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const presenceChannel = useRef<any>(null);

  // Initialize presence tracking
  useEffect(() => {
    if (!userId) return;

    const initializePresence = async () => {
      // Update user presence to online
      await supabase
        .from('user_presence')
        .upsert({
          user_id: userId,
          is_online: true,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      // Set up presence channel
      presenceChannel.current = supabase
        .channel('user_presence')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'user_presence'
        }, () => {
          fetchOnlineUsers();
        })
        .subscribe();

      // Fetch initial online users
      await fetchOnlineUsers();
    };

    initializePresence();

    // Cleanup on unmount
    return () => {
      if (presenceChannel.current) {
        supabase.removeChannel(presenceChannel.current);
      }
      // Set user offline
      if (userId) {
        supabase
          .from('user_presence')
          .upsert({
            user_id: userId,
            is_online: false,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
      }
    };
  }, [userId]);

  // Fetch online users
  const fetchOnlineUsers = async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('user_presence')
      .select('*')
      .eq('is_online', true)
      .neq('user_id', userId);

    if (error) {
      console.error('Error fetching online users:', error);
      return;
    }

    // Fetch profile data separately
    const userIds = (data || []).map(item => item.user_id);
    if (userIds.length === 0) {
      setOnlineUsers([]);
      return;
    }

    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', userIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    }

    // Combine presence data with profile data
    const transformedData = (data || []).map(item => {
      const profile = (profilesData || []).find(p => p.id === item.user_id);
      return {
        ...item,
        profile: profile ? {
          display_name: profile.display_name || 'Unknown User',
          avatar_url: profile.avatar_url
        } : { display_name: 'Unknown User' }
      };
    });

    setOnlineUsers(transformedData);
  };

  return {
    onlineUsers,
    fetchOnlineUsers,
  };
}
