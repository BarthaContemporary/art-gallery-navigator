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

export function useSimplifiedChat() {
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
  const retryCount = useRef<number>(0);
  const maxRetries = 3;

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

  // Fetch messages for a room with enhanced fallback for failed decryption
  const fetchMessages = useCallback(async (roomId: string) => {
    if (!user) return;

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      console.log('Fetching messages for room:', roomId, 'user:', user.id);

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

      // Decrypt messages with comprehensive fallback
      let encryptionKey: CryptoKey | null = null;
      try {
        console.log('Generating encryption key for message decryption...');
        encryptionKey = await ChatEncryption.generateRoomKey(roomId, user.id);
      } catch (error) {
        console.error('Failed to generate encryption key for decryption:', error);
        encryptionKey = null;
      }

      const decryptedMessages = await Promise.all(
        data.map(async (message) => {
          const senderProfile = profilesData?.find(p => p.id === message.sender_id);
          
          let decryptedContent: string;
          
          if (encryptionKey) {
            try {
              console.log('Attempting to decrypt message:', message.id);
              decryptedContent = await ChatEncryption.decryptMessage(message.encrypted_content, encryptionKey);
              console.log('Successfully decrypted message:', message.id);
            } catch (error) {
              console.error('Failed to decrypt message, trying fallback:', message.id, error);
              try {
                // Try fallback decoding
                decryptedContent = ChatEncryption.decodeFallbackEncoding(message.encrypted_content);
                console.log('Successfully decoded fallback message:', message.id);
              } catch (fallbackError) {
                console.error('Fallback decoding also failed:', message.id, fallbackError);
                decryptedContent = '[Message could not be decrypted]';
              }
            }
          } else {
            console.log('No encryption key available, trying fallback decoding for message:', message.id);
            try {
              decryptedContent = ChatEncryption.decodeFallbackEncoding(message.encrypted_content);
            } catch (error) {
              console.error('Fallback decoding failed:', message.id, error);
              decryptedContent = '[Encryption key unavailable]';
            }
          }

          return {
            ...message,
            decrypted_content: decryptedContent,
            sender_profile: senderProfile ? {
              display_name: senderProfile.display_name || 'Unknown User',
              avatar_url: senderProfile.avatar_url
            } : { display_name: 'Unknown User' }
          };
        })
      );

      setState(prev => ({ ...prev, messages: decryptedMessages, loading: false }));
    } catch (error) {
      console.error('Error fetching messages:', error);
      setState(prev => ({ ...prev, error: 'Failed to load messages', loading: false }));
    }
  }, [user]);

  // Send message with robust error handling and comprehensive fallback
  const sendMessage = useCallback(async (content: string, roomId: string, type: 'text' | 'file' | 'image' = 'text') => {
    if (!user || !content.trim()) {
      console.error('Missing user or empty content for sendMessage');
      toast.error('Cannot send empty message');
      return;
    }

    if (!roomId) {
      console.error('Missing roomId for sendMessage');
      toast.error('Invalid chat room');
      return;
    }

    setState(prev => ({ ...prev, sending: true, error: null }));
    console.log('Attempting to send message:', { content: content.substring(0, 50), roomId, userId: user.id, type });

    try {
      // Attempt encryption with comprehensive fallback
      let encryptedContent: string;
      let encryptionSuccessful = false;

      try {
        console.log('Generating encryption key for message sending...');
        const key = await ChatEncryption.generateRoomKey(roomId, user.id);
        
        console.log('Encrypting message content...');
        encryptedContent = await ChatEncryption.encryptMessage(content, key);
        encryptionSuccessful = true;
        console.log('Message encrypted successfully');
      } catch (encryptionError) {
        console.error('Encryption failed, using fallback encoding:', encryptionError);
        try {
          encryptedContent = ChatEncryption.createFallbackEncoding(content);
          console.log('Fallback encoding successful');
          toast.warning('Message sent with reduced security');
        } catch (fallbackError) {
          console.error('Fallback encoding also failed:', fallbackError);
          encryptedContent = content; // Last resort: send unencrypted
          toast.warning('Message sent without encryption');
        }
      }

      console.log('Inserting message to database...');
      
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_id: user.id,
          encrypted_content: encryptedContent,
          message_type: type,
        })
        .select()
        .single();

      if (error) {
        console.error('Database insert error:', error);
        throw error;
      }

      console.log('Message sent successfully:', data.id);
      retryCount.current = 0; // Reset retry count on success

      if (encryptionSuccessful) {
        toast.success('Message sent securely');
      }

    } catch (error) {
      console.error('Error sending message:', error);
      retryCount.current++;
      
      if (retryCount.current < maxRetries) {
        console.log(`Retrying send message... (${retryCount.current}/${maxRetries})`);
        toast.info(`Retrying... (${retryCount.current}/${maxRetries})`);
        setTimeout(() => {
          sendMessage(content, roomId, type);
        }, 1000 * retryCount.current);
      } else {
        console.error('Max retries reached for sending message');
        toast.error('Failed to send message after multiple attempts');
        retryCount.current = 0;
      }
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

  // Subscribe to real-time messages with comprehensive fallback decryption
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

            // Decrypt message with comprehensive fallback
            let decryptedContent: string;
            try {
              const key = await ChatEncryption.generateRoomKey(roomId, user?.id);
              decryptedContent = await ChatEncryption.decryptMessage(newMessage.encrypted_content, key);
            } catch (error) {
              console.error('Real-time decryption failed, trying fallback:', error);
              try {
                decryptedContent = ChatEncryption.decodeFallbackEncoding(newMessage.encrypted_content);
              } catch (fallbackError) {
                console.error('Real-time fallback decoding also failed:', fallbackError);
                decryptedContent = '[Message could not be decrypted]';
              }
            }

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
    // Clear channels
    if (messagesChannel.current) {
      supabase.removeChannel(messagesChannel.current);
      messagesChannel.current = null;
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

    // Reset retry count
    retryCount.current = 0;

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
