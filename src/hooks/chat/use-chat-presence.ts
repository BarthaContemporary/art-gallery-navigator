
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserPresence } from './types';

export function useChatPresence(userId?: string) {
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const presenceChannel = useRef<any>(null);
  const currentUserId = userId;

  // Fetch online users
  const fetchOnlineUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_presence')
        .select('*');

      if (error) {
        console.error('Error fetching online users:', error);
        return;
      }

      // Get all users (online and offline) and their profiles
      if (data && data.length > 0) {
        const userIds = data.map(item => item.user_id);
        
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds);

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
        }

        // Combine presence data with profile data
        const transformedData = data.map(item => {
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
      } else {
        setOnlineUsers([]);
      }
    } catch (error) {
      console.error('Error in fetchOnlineUsers:', error);
    }
  }, []); // Empty deps - stable reference

  // Initialize presence tracking
  useEffect(() => {
    let isMounted = true;
    
    if (!currentUserId) {
      // Still fetch online users even if we don't have a current user
      if (isMounted) {
        fetchOnlineUsers();
      }
      return;
    }

    const initializePresence = async () => {
      if (!isMounted) return;
      
      // Update user presence to online
      await supabase
        .from('user_presence')
        .upsert({
          user_id: currentUserId,
          is_online: true,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (!isMounted) return;

      // Set up presence channel
      presenceChannel.current = supabase
        .channel('user_presence')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'user_presence'
        }, () => {
          if (isMounted) {
            fetchOnlineUsers();
          }
        })
        .subscribe();

      // Fetch initial online users
      if (isMounted) {
        await fetchOnlineUsers();
      }
    };

    initializePresence();

    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (presenceChannel.current) {
        supabase.removeChannel(presenceChannel.current);
        presenceChannel.current = null;
      }
      // Set user offline
      if (currentUserId) {
        supabase
          .from('user_presence')
          .upsert({
            user_id: currentUserId,
            is_online: false,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
      }
    };
  }, [currentUserId, fetchOnlineUsers]);

  return {
    onlineUsers,
    fetchOnlineUsers,
  };
}
