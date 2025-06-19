
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChatRoom, ChatMessage } from './types';

export function useChatData(user: any, setState: any) {
  // Fetch messages for a room with pagination
  const fetchMessages = useCallback(async (roomId: string, limit: number = 50, offset: number = 0, loadMore: boolean = false) => {
    if (!user) return;

    try {
      if (!loadMore) {
        setState((prev: any) => ({ ...prev, loading: true }));
      } else {
        setState((prev: any) => ({ ...prev, loadingMore: true }));
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching messages:', error);
        toast.error('Failed to load messages');
        return;
      }

      if (!data || data.length === 0) {
        if (!loadMore) {
          setState((prev: any) => ({ ...prev, messages: [], hasMore: false, loading: false, loadingMore: false }));
        } else {
          setState((prev: any) => ({ ...prev, hasMore: false, loadingMore: false }));
        }
        return;
      }

      // Check if we have fewer messages than requested (reached the end)
      const hasMoreMessages = data.length === limit;

      // Fetch profile data for all senders
      const senderIds = data.map(message => message.sender_id);
      const uniqueSenderIds = [...new Set(senderIds)];
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', uniqueSenderIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      // Create profiles map for efficient lookup
      const profilesMap = new Map();
      (profilesData || []).forEach(profile => {
        profilesMap.set(profile.id, profile);
      });

      // Transform messages with profile data
      const transformedMessages = data.map(message => {
        const senderProfile = profilesMap.get(message.sender_id);
        
        return {
          ...message,
          sender_profile: senderProfile ? {
            display_name: senderProfile.display_name || 'Unknown User',
            avatar_url: senderProfile.avatar_url
          } : { display_name: 'Unknown User' }
        };
      });

      // Reverse to show oldest first in UI
      const orderedMessages = transformedMessages.reverse();

      if (loadMore) {
        // Prepend older messages to existing ones
        setState((prev: any) => ({ 
          ...prev, 
          messages: [...orderedMessages, ...prev.messages],
          hasMore: hasMoreMessages,
          loadingMore: false
        }));
      } else {
        // Set initial messages
        setState((prev: any) => ({ 
          ...prev, 
          messages: orderedMessages,
          hasMore: hasMoreMessages,
          loading: false,
          loadingMore: false
        }));
      }
    } catch (error) {
      console.error('Error in fetchMessages:', error);
      toast.error('Failed to load messages');
      setState((prev: any) => ({ ...prev, loading: false, loadingMore: false }));
    }
  }, [user, setState]);

  // Fetch chat rooms
  const fetchChatRooms = useCallback(async () => {
    if (!user) return;

    setState((prev: any) => ({ ...prev, loading: true }));

    try {
      const { data: rooms, error } = await supabase
        .from('chat_rooms')
        .select(`
          *,
          participant_1_profile:profiles!participant_1_id(display_name, avatar_url),
          participant_2_profile:profiles!participant_2_id(display_name, avatar_url)
        `)
        .or(`participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;

      setState((prev: any) => ({ 
        ...prev, 
        chatRooms: rooms || [],
        loading: false 
      }));
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
      toast.error('Failed to load chat rooms');
      setState((prev: any) => ({ ...prev, loading: false }));
    }
  }, [user, setState]);

  // Start chat with user
  const startChatWithUser = useCallback(async (targetUserId: string) => {
    if (!user) return null;

    try {
      // Check if room already exists
      const { data: existingRoom } = await supabase
        .from('chat_rooms')
        .select('*')
        .or(`and(participant_1_id.eq.${user.id},participant_2_id.eq.${targetUserId}),and(participant_1_id.eq.${targetUserId},participant_2_id.eq.${user.id})`)
        .single();

      if (existingRoom) {
        return existingRoom;
      }

      // Create new room
      const { data: newRoom, error } = await supabase
        .from('chat_rooms')
        .insert({
          participant_1_id: user.id,
          participant_2_id: targetUserId,
        })
        .select()
        .single();

      if (error) throw error;

      // Refresh chat rooms
      await fetchChatRooms();

      return newRoom;
    } catch (error) {
      console.error('Error starting chat:', error);
      toast.error('Failed to start chat');
      return null;
    }
  }, [user, fetchChatRooms, setState]);

  // Fetch online users
  const fetchOnlineUsers = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_presence')
        .select('*');

      if (error) throw error;

      if (!data || data.length === 0) {
        setState((prev: any) => ({ ...prev, onlineUsers: [] }));
        return;
      }

      // Filter out current user and calculate sophisticated status
      const filteredData = data.filter(item => item.user_id !== user.id);

      if (filteredData.length === 0) {
        setState((prev: any) => ({ ...prev, onlineUsers: [] }));
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

      setState((prev: any) => ({ ...prev, onlineUsers: transformedData }));
    } catch (error) {
      console.error('Error fetching online users:', error);
    }
  }, [user, setState]);

  return {
    fetchMessages,
    fetchChatRooms,
    startChatWithUser,
    fetchOnlineUsers,
  };
}
