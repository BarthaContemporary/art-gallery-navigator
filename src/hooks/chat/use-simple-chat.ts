
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../use-auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChatRoom, ChatMessage, UserPresence } from './types';

interface ChatState {
  chatRooms: ChatRoom[];
  activeRoom: ChatRoom | null;
  messages: ChatMessage[];
  onlineUsers: UserPresence[];
  loading: boolean;
  sending: boolean;
  connected: boolean;
  error: string | null;
}

export function useSimpleChat() {
  const { user, isLoading: authLoading } = useAuth();
  const [state, setState] = useState<ChatState>({
    chatRooms: [],
    activeRoom: null,
    messages: [],
    onlineUsers: [],
    loading: false,
    sending: false,
    connected: false,
    error: null,
  });

  const messagesChannel = useRef<any>(null);

  // Fetch chat rooms
  const fetchChatRooms = useCallback(async () => {
    if (!user) return;

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const { data, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .or(`participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        setState(prev => ({ ...prev, chatRooms: [], loading: false }));
        return;
      }

      // Fetch profile data
      const participantIds = data.flatMap(room => [room.participant_1_id, room.participant_2_id]);
      const uniqueParticipantIds = [...new Set(participantIds)];
      
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', uniqueParticipantIds);

      // Transform data with profiles
      const roomsWithProfiles = data.map(room => {
        const participant1Profile = profilesData?.find(p => p.id === room.participant_1_id);
        const participant2Profile = profilesData?.find(p => p.id === room.participant_2_id);
        
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
          unread_count: 0
        };
      });

      setState(prev => ({ ...prev, chatRooms: roomsWithProfiles, loading: false }));
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
      setState(prev => ({ ...prev, error: 'Failed to load chat rooms', loading: false }));
    }
  }, [user]);

  // Fetch messages for a room (no encryption)
  const fetchMessages = useCallback(async (roomId: string) => {
    if (!user) return;

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        setState(prev => ({ ...prev, messages: [], loading: false }));
        return;
      }

      // Fetch sender profiles
      const senderIds = [...new Set(data.map(msg => msg.sender_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', senderIds);

      // Transform messages with profiles (use encrypted_content as plain text)
      const messagesWithProfiles = data.map((message) => {
        const senderProfile = profilesData?.find(p => p.id === message.sender_id);
        
        return {
          ...message,
          decrypted_content: message.encrypted_content, // Use as plain text
          sender_profile: senderProfile ? {
            display_name: senderProfile.display_name || 'Unknown User',
            avatar_url: senderProfile.avatar_url
          } : { display_name: 'Unknown User' }
        };
      });

      setState(prev => ({ ...prev, messages: messagesWithProfiles, loading: false }));
    } catch (error) {
      console.error('Error fetching messages:', error);
      setState(prev => ({ ...prev, error: 'Failed to load messages', loading: false }));
    }
  }, [user]);

  // Send message (no encryption)
  const sendMessage = useCallback(async (content: string, roomId: string, type: 'text' | 'file' | 'image' = 'text') => {
    if (!user || !content.trim()) {
      toast.error('Cannot send empty message');
      return;
    }

    if (!roomId) {
      toast.error('Invalid chat room');
      return;
    }

    setState(prev => ({ ...prev, sending: true, error: null }));

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_id: user.id,
          encrypted_content: content, // Store as plain text
          message_type: type,
        })
        .select()
        .single();

      if (error) {
        console.error('Database insert error:', error);
        throw error;
      }

      console.log('Message sent successfully:', data.id);
      toast.success('Message sent');

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setState(prev => ({ ...prev, sending: false }));
    }
  }, [user]);

  // Start or find chat with user
  const startChatWithUser = useCallback(async (targetUserId: string): Promise<ChatRoom | null> => {
    if (!user) return null;

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const { data, error } = await supabase.rpc('find_or_create_chat_room', {
        _participant_1_id: user.id,
        _participant_2_id: targetUserId
      });

      if (error) throw error;

      // Fetch the complete room data
      const { data: roomData, error: roomError } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('id', data)
        .single();

      if (roomError) throw roomError;

      // Fetch profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', [roomData.participant_1_id, roomData.participant_2_id]);

      const participant1Profile = profilesData?.find(p => p.id === roomData.participant_1_id);
      const participant2Profile = profilesData?.find(p => p.id === roomData.participant_2_id);

      const transformedRoom = {
        ...roomData,
        participant_1_profile: participant1Profile ? {
          display_name: participant1Profile.display_name || 'Unknown User',
          avatar_url: participant1Profile.avatar_url
        } : { display_name: 'Unknown User' },
        participant_2_profile: participant2Profile ? {
          display_name: participant2Profile.display_name || 'Unknown User',
          avatar_url: participant2Profile.avatar_url
        } : { display_name: 'Unknown User' },
        unread_count: 0
      };

      setState(prev => ({ ...prev, loading: false }));
      await fetchChatRooms();
      
      return transformedRoom;
    } catch (error) {
      console.error('Error starting chat:', error);
      setState(prev => ({ ...prev, error: 'Failed to start chat', loading: false }));
      return null;
    }
  }, [user, fetchChatRooms]);

  // Set active room and fetch messages
  const setActiveRoomAndFetchMessages = useCallback(async (room: ChatRoom) => {
    setState(prev => ({ ...prev, activeRoom: room }));
    await fetchMessages(room.id);
    subscribeToMessages(room.id);
  }, [fetchMessages]);

  // Subscribe to real-time messages (no encryption)
  const subscribeToMessages = useCallback(async (roomId: string) => {
    if (messagesChannel.current) {
      supabase.removeChannel(messagesChannel.current);
    }

    try {
      messagesChannel.current = supabase
        .channel(`messages:${roomId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`
        }, async (payload) => {
          const newMessage = payload.new as ChatMessage;
          
          try {
            // Fetch sender profile
            const { data: senderProfile } = await supabase
              .from('profiles')
              .select('id, display_name, avatar_url')
              .eq('id', newMessage.sender_id)
              .single();

            const messageWithProfile = {
              ...newMessage,
              decrypted_content: newMessage.encrypted_content, // Use as plain text
              sender_profile: senderProfile ? {
                display_name: senderProfile.display_name || 'Unknown User',
                avatar_url: senderProfile.avatar_url
              } : { display_name: 'Unknown User' }
            };

            setState(prev => ({ ...prev, messages: [...prev.messages, messageWithProfile] }));

            // Show notification for messages from others
            if (newMessage.sender_id !== user?.id) {
              toast.info(`New message from ${senderProfile?.display_name || 'Unknown User'}`);
            }
          } catch (error) {
            console.error('Error handling real-time message:', error);
          }
        })
        .subscribe((status) => {
          setState(prev => ({ ...prev, connected: status === 'SUBSCRIBED' }));
        });
    } catch (error) {
      console.error('Error subscribing to messages:', error);
      setState(prev => ({ ...prev, error: 'Real-time connection failed' }));
    }
  }, [user]);

  // Fetch online users
  const fetchOnlineUsers = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_presence')
        .select('*')
        .eq('is_online', true)
        .neq('user_id', user.id);

      if (error) throw error;

      if (!data || data.length === 0) {
        setState(prev => ({ ...prev, onlineUsers: [] }));
        return;
      }

      // Fetch profiles
      const userIds = data.map(item => item.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      const usersWithProfiles = data.map(item => {
        const profile = profilesData?.find(p => p.id === item.user_id);
        return {
          ...item,
          profile: profile ? {
            display_name: profile.display_name || 'Unknown User',
            avatar_url: profile.avatar_url
          } : { display_name: 'Unknown User' }
        };
      });

      setState(prev => ({ ...prev, onlineUsers: usersWithProfiles }));
    } catch (error) {
      console.error('Error fetching online users:', error);
    }
  }, [user]);

  // Clear cache
  const clearAllChatCache = useCallback(() => {
    if (messagesChannel.current) {
      supabase.removeChannel(messagesChannel.current);
      messagesChannel.current = null;
    }

    setState({
      chatRooms: [],
      activeRoom: null,
      messages: [],
      onlineUsers: [],
      loading: false,
      sending: false,
      connected: false,
      error: null,
    });

    toast.success('Chat cache cleared');
  }, []);

  // Initialize chat when user is available
  useEffect(() => {
    if (!authLoading && user) {
      fetchChatRooms();
      fetchOnlineUsers();
    }
  }, [authLoading, user, fetchChatRooms, fetchOnlineUsers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (messagesChannel.current) {
        supabase.removeChannel(messagesChannel.current);
      }
    };
  }, []);

  return {
    ...state,
    fetchChatRooms,
    startChatWithUser,
    setActiveRoomAndFetchMessages,
    sendMessage,
    fetchOnlineUsers,
    clearAllChatCache,
  };
}
