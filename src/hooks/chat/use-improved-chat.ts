
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../use-auth';
import { supabase } from '@/integrations/supabase/client';
import { ChatEncryption } from '@/lib/chat-encryption';
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

export function useImprovedChat() {
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
  const presenceChannel = useRef<any>(null);
  const retryTimeouts = useRef<Set<NodeJS.Timeout>>(new Set());

  // Clear any retry timeouts
  const clearRetryTimeouts = useCallback(() => {
    retryTimeouts.current.forEach(timeout => clearTimeout(timeout));
    retryTimeouts.current.clear();
  }, []);

  // Retry logic with exponential backoff
  const retryOperation = useCallback((operation: () => Promise<void>, attempt = 1) => {
    const maxAttempts = 3;
    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);

    const timeout = setTimeout(async () => {
      try {
        await operation();
        retryTimeouts.current.delete(timeout);
      } catch (error) {
        console.error(`Operation failed (attempt ${attempt}):`, error);
        if (attempt < maxAttempts) {
          retryOperation(operation, attempt + 1);
        } else {
          setState(prev => ({ ...prev, error: 'Operation failed after multiple attempts' }));
        }
        retryTimeouts.current.delete(timeout);
      }
    }, delay);

    retryTimeouts.current.add(timeout);
  }, []);

  // Fetch chat rooms with error handling
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

  // Fetch messages for a room
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

      // Decrypt messages
      const key = await ChatEncryption.generateRoomKey(roomId);
      const decryptedMessages = await Promise.all(
        data.map(async (message) => {
          const senderProfile = profilesData?.find(p => p.id === message.sender_id);
          
          try {
            const decryptedContent = await ChatEncryption.decryptMessage(message.encrypted_content, key);
            return {
              ...message,
              decrypted_content: decryptedContent,
              sender_profile: senderProfile ? {
                display_name: senderProfile.display_name || 'Unknown User',
                avatar_url: senderProfile.avatar_url
              } : { display_name: 'Unknown User' }
            };
          } catch (error) {
            console.error('Failed to decrypt message:', error);
            return {
              ...message,
              decrypted_content: '[Message could not be decrypted]',
              sender_profile: senderProfile ? {
                display_name: senderProfile.display_name || 'Unknown User',
                avatar_url: senderProfile.avatar_url
              } : { display_name: 'Unknown User' }
            };
          }
        })
      );

      setState(prev => ({ ...prev, messages: decryptedMessages, loading: false }));
    } catch (error) {
      console.error('Error fetching messages:', error);
      setState(prev => ({ ...prev, error: 'Failed to load messages', loading: false }));
    }
  }, [user]);

  // Send message with retry logic
  const sendMessage = useCallback(async (content: string, roomId: string, type: 'text' | 'file' | 'image' = 'text') => {
    if (!user || !content.trim()) return;

    setState(prev => ({ ...prev, sending: true, error: null }));

    const sendOperation = async () => {
      try {
        const key = await ChatEncryption.generateRoomKey(roomId);
        const encryptedContent = await ChatEncryption.encryptMessage(content, key);

        const { error } = await supabase
          .from('chat_messages')
          .insert({
            room_id: roomId,
            sender_id: user.id,
            encrypted_content: encryptedContent,
            message_type: type,
          });

        if (error) throw error;
        
        setState(prev => ({ ...prev, sending: false }));
      } catch (error) {
        console.error('Error sending message:', error);
        setState(prev => ({ ...prev, sending: false }));
        throw error;
      }
    };

    try {
      await sendOperation();
    } catch (error) {
      retryOperation(sendOperation);
    }
  }, [user, retryOperation]);

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
      await fetchChatRooms(); // Refresh rooms list
      
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

  // Subscribe to real-time messages
  const subscribeToMessages = useCallback(async (roomId: string) => {
    // Clean up existing subscription
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

            // Decrypt message
            const key = await ChatEncryption.generateRoomKey(roomId);
            const decryptedContent = await ChatEncryption.decryptMessage(newMessage.encrypted_content, key);

            const messageWithProfile = {
              ...newMessage,
              decrypted_content: decryptedContent,
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

  // Clear all chat cache and reset state
  const clearAllChatCache = useCallback(() => {
    // Clear timeouts
    clearRetryTimeouts();
    
    // Clear channels
    if (messagesChannel.current) {
      supabase.removeChannel(messagesChannel.current);
      messagesChannel.current = null;
    }
    if (presenceChannel.current) {
      supabase.removeChannel(presenceChannel.current);
      presenceChannel.current = null;
    }

    // Clear encryption cache
    ChatEncryption.clearCache();

    // Reset state
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
  }, [clearRetryTimeouts]);

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
      clearRetryTimeouts();
      if (messagesChannel.current) {
        supabase.removeChannel(messagesChannel.current);
      }
      if (presenceChannel.current) {
        supabase.removeChannel(presenceChannel.current);
      }
    };
  }, [clearRetryTimeouts]);

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
