
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChatRoom, ChatMessage, UserPresence } from './types';
import { toast } from 'sonner';

export function useChatAPI(userId?: string) {
  const fetchRooms = useCallback(async (): Promise<ChatRoom[]> => {
    if (!userId) return [];

    const { data, error } = await supabase
      .from('chat_rooms')
      .select(`
        *,
        last_message:chat_messages(
          id,
          encrypted_content,
          message_type,
          created_at,
          sender_id
        )
      `)
      .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) throw error;

    // Fetch profile data for participants
    const roomIds = (data || []).map(room => room.id);
    if (roomIds.length === 0) return [];

    const participantIds = new Set<string>();
    (data || []).forEach(room => {
      participantIds.add(room.participant_1_id);
      participantIds.add(room.participant_2_id);
    });

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', Array.from(participantIds));

    const profilesMap = new Map();
    (profilesData || []).forEach(profile => {
      profilesMap.set(profile.id, profile);
    });

    // Transform rooms with profile data
    const transformedRooms: ChatRoom[] = (data || []).map(room => {
      const participant1Profile = profilesMap.get(room.participant_1_id);
      const participant2Profile = profilesMap.get(room.participant_2_id);

      return {
        ...room,
        participant_1_profile: participant1Profile ? {
          display_name: participant1Profile.display_name || 'Unknown User',
          avatar_url: participant1Profile.avatar_url
        } : { display_name: 'Unknown User' },
        participant_2_profile: participant2Profile ? {
          display_name: participant2Profile.display_name || 'Unknown User',
          avatar_url: participant2Profile.avatar_url
        } : { display_name: 'Unknown User' },
        last_message: Array.isArray(room.last_message) && room.last_message.length > 0 
          ? room.last_message[0] 
          : undefined
      };
    });

    return transformedRooms;
  }, [userId]);

  const fetchMessages = useCallback(async (
    roomId: string,
    limit: number = 50,
    offset: number = 0,
    cursor?: string
  ): Promise<{ messages: ChatMessage[]; hasMore: boolean; nextCursor?: string }> => {
    if (!userId) return { messages: [], hasMore: false };

    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });

    if (cursor) {
      query = query.lt('created_at', cursor);
    } else if (offset > 0) {
      query = query.range(offset, offset + limit - 1);
    } else {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data || data.length === 0) {
      return { messages: [], hasMore: false };
    }

    const hasMore = data.length === limit;
    const nextCursor = hasMore ? data[data.length - 1].created_at : undefined;

    // Fetch profile data for all senders
    const senderIds = [...new Set(data.map(message => message.sender_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', senderIds);

    const profilesMap = new Map();
    (profilesData || []).forEach(profile => {
      profilesMap.set(profile.id, profile);
    });

    // Transform messages with profile data and reverse order
    const transformedMessages = data.map(message => {
      const senderProfile = profilesMap.get(message.sender_id);
      return {
        ...message,
        sender_profile: senderProfile ? {
          display_name: senderProfile.display_name || 'Unknown User',
          avatar_url: senderProfile.avatar_url
        } : { display_name: 'Unknown User' }
      };
    }).reverse();

    return { messages: transformedMessages, hasMore, nextCursor };
  }, [userId]);

  const sendMessage = useCallback(async (
    content: string,
    roomId: string,
    type: 'text' | 'file' | 'image' = 'text'
  ): Promise<ChatMessage> => {
    if (!userId || !content.trim()) {
      throw new Error('Missing userId or empty content');
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        sender_id: userId,
        encrypted_content: content,
        message_type: type,
      })
      .select()
      .single();

    if (error) throw error;

    // Fetch sender profile
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .eq('id', userId)
      .single();

    return {
      ...data,
      sender_profile: senderProfile ? {
        display_name: senderProfile.display_name || 'Unknown User',
        avatar_url: senderProfile.avatar_url
      } : { display_name: 'Unknown User' }
    };
  }, [userId]);

  const createOrGetRoom = useCallback(async (participant1Id: string, participant2Id: string): Promise<ChatRoom> => {
    const { data, error } = await supabase.rpc('find_or_create_chat_room', {
      _participant_1_id: participant1Id,
      _participant_2_id: participant2Id
    });

    if (error) throw error;

    // Fetch the complete room data
    const { data: roomData, error: roomError } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('id', data)
      .single();

    if (roomError) throw roomError;

    // Fetch profile data for participants
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', [roomData.participant_1_id, roomData.participant_2_id]);

    const profilesMap = new Map();
    (profilesData || []).forEach(profile => {
      profilesMap.set(profile.id, profile);
    });

    const participant1Profile = profilesMap.get(roomData.participant_1_id);
    const participant2Profile = profilesMap.get(roomData.participant_2_id);

    return {
      ...roomData,
      participant_1_profile: participant1Profile ? {
        display_name: participant1Profile.display_name || 'Unknown User',
        avatar_url: participant1Profile.avatar_url
      } : { display_name: 'Unknown User' },
      participant_2_profile: participant2Profile ? {
        display_name: participant2Profile.display_name || 'Unknown User',
        avatar_url: participant2Profile.avatar_url
      } : { display_name: 'Unknown User' }
    };
  }, []);

  const markMessagesAsRead = useCallback(async (roomId: string) => {
    if (!userId) return;

    const { data: unreadMessages } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('room_id', roomId)
      .not('read_by', 'cs', `{${userId}}`);

    if (unreadMessages && unreadMessages.length > 0) {
      for (const message of unreadMessages) {
        await supabase.rpc('mark_message_as_read', {
          message_id: message.id,
          reader_id: userId
        });
      }
    }
  }, [userId]);

  const fetchOnlineUsers = useCallback(async (): Promise<UserPresence[]> => {
    const { data, error } = await supabase
      .from('user_presence')
      .select('*');

    if (error) throw error;

    if (!data || data.length === 0) return [];

    // Filter out current user and get only online users
    const filteredData = data.filter(item => 
      item.user_id !== userId && item.is_online
    );

    if (filteredData.length === 0) return [];

    // Fetch profiles
    const userIds = filteredData.map(item => item.user_id);
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', userIds);

    return filteredData.map(item => {
      const profile = (profilesData || []).find(p => p.id === item.user_id);
      return {
        ...item,
        profile: profile ? {
          display_name: profile.display_name || 'Unknown User',
          avatar_url: profile.avatar_url
        } : { display_name: 'Unknown User' }
      };
    });
  }, [userId]);

  return {
    fetchRooms,
    fetchMessages,
    sendMessage,
    createOrGetRoom,
    markMessagesAsRead,
    fetchOnlineUsers,
  };
}
