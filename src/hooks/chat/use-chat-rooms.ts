
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChatRoom } from './types';

export function useChatRooms(userId?: string) {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);

  // Fetch chat rooms
  const fetchChatRooms = async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('chat_rooms')
      .select('*')
      .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error fetching chat rooms:', error);
      toast.error('Failed to load chat rooms');
      return;
    }

    // Fetch profile data for all participants
    const participantIds = (data || []).flatMap(room => [room.participant_1_id, room.participant_2_id]);
    const uniqueParticipantIds = [...new Set(participantIds)];
    
    if (uniqueParticipantIds.length === 0) {
      setChatRooms([]);
      return;
    }

    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', uniqueParticipantIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    }

    // Transform the data to match our interface
    const transformedData = (data || []).map(room => {
      const participant1Profile = (profilesData || []).find(p => p.id === room.participant_1_id);
      const participant2Profile = (profilesData || []).find(p => p.id === room.participant_2_id);
      
      return {
        ...room,
        participant_1_profile: participant1Profile ? {
          display_name: participant1Profile.display_name || 'Unknown User',
          avatar_url: participant1Profile.avatar_url
        } : { display_name: 'Unknown User' },
        participant_2_profile: participant2Profile ? {
          display_name: participant2Profile.display_name || 'Unknown User',
          avatar_url: participant2Profile.avatar_url
        } : { display_name: 'Unknown User' }
      };
    });

    setChatRooms(transformedData);
  };

  // Start or find chat with user
  const startChatWithUser = async (targetUserId: string): Promise<ChatRoom | null> => {
    if (!userId) return null;

    try {
      const { data, error } = await supabase.rpc('find_or_create_chat_room', {
        _participant_1_id: userId,
        _participant_2_id: targetUserId
      });

      if (error) throw error;

      const roomId = data;
      
      // Fetch the complete room data
      const { data: roomData, error: roomError } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomError) throw roomError;

      // Fetch profile data for participants
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', [roomData.participant_1_id, roomData.participant_2_id]);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      const participant1Profile = (profilesData || []).find(p => p.id === roomData.participant_1_id);
      const participant2Profile = (profilesData || []).find(p => p.id === roomData.participant_2_id);

      // Transform the data
      const transformedRoom = {
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

      // Update chat rooms list
      await fetchChatRooms();
      
      return transformedRoom;
    } catch (error) {
      console.error('Error starting chat:', error);
      toast.error('Failed to start chat');
      return null;
    }
  };

  return {
    chatRooms,
    fetchChatRooms,
    startChatWithUser,
  };
}
