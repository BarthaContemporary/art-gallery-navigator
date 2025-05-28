
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';
import { ChatEncryption } from '@/lib/encryption';
import { toast } from 'sonner';

export interface ChatRoom {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  participant_1_profile?: { display_name: string; avatar_url?: string };
  participant_2_profile?: { display_name: string; avatar_url?: string };
  last_message?: ChatMessage;
  unread_count?: number;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  encrypted_content: string;
  decrypted_content?: string;
  message_type: 'text' | 'file' | 'image';
  created_at: string;
  edited_at?: string;
  read_by: string[];
  sender_profile?: { display_name: string; avatar_url?: string };
}

export interface UserPresence {
  user_id: string;
  is_online: boolean;
  last_seen: string;
  updated_at: string;
  profile?: { display_name: string; avatar_url?: string };
}

export function useChat() {
  const { user } = useAuth();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const encryptionKeys = useRef<Map<string, CryptoKey>>(new Map());
  const presenceChannel = useRef<any>(null);
  const messagesChannel = useRef<any>(null);

  // Initialize presence tracking
  useEffect(() => {
    if (!user) return;

    const initializePresence = async () => {
      // Update user presence to online
      await supabase
        .from('user_presence')
        .upsert({
          user_id: user.id,
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
        }, (payload) => {
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
      if (user) {
        supabase
          .from('user_presence')
          .upsert({
            user_id: user.id,
            is_online: false,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
      }
    };
  }, [user]);

  // Fetch online users
  const fetchOnlineUsers = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_presence')
      .select('*')
      .eq('is_online', true)
      .neq('user_id', user.id);

    if (error) {
      console.error('Error fetching online users:', error);
      return;
    }

    // Fetch profile data separately
    const userIds = (data || []).map(item => item.user_id);
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

  // Fetch chat rooms
  const fetchChatRooms = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('chat_rooms')
      .select('*')
      .or(`participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error fetching chat rooms:', error);
      toast.error('Failed to load chat rooms');
      setLoading(false);
      return;
    }

    // Fetch profile data for all participants
    const participantIds = (data || []).flatMap(room => [room.participant_1_id, room.participant_2_id]);
    const uniqueParticipantIds = [...new Set(participantIds)];
    
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
    setLoading(false);
  };

  // Get or create encryption key for room
  const getRoomEncryptionKey = async (roomId: string): Promise<CryptoKey> => {
    if (!user) throw new Error('User not authenticated');
    
    if (encryptionKeys.current.has(roomId)) {
      return encryptionKeys.current.get(roomId)!;
    }

    const key = await ChatEncryption.generateRoomKey(roomId, user.id);
    encryptionKeys.current.set(roomId, key);
    return key;
  };

  // Start or find chat with user
  const startChatWithUser = async (targetUserId: string): Promise<ChatRoom | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase.rpc('find_or_create_chat_room', {
        _participant_1_id: user.id,
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

  // Set active room and fetch messages
  const setActiveRoomAndFetchMessages = async (room: ChatRoom) => {
    setActiveRoom(room);
    await fetchMessages(room.id);
    
    // Set up real-time subscription for this room
    if (messagesChannel.current) {
      supabase.removeChannel(messagesChannel.current);
    }

    messagesChannel.current = supabase
      .channel(`messages:${room.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${room.id}`
      }, async (payload) => {
        const newMessage = payload.new as ChatMessage;
        
        // Decrypt the message
        try {
          const key = await getRoomEncryptionKey(room.id);
          const decryptedContent = await ChatEncryption.decryptMessage(newMessage.encrypted_content, key);
          newMessage.decrypted_content = decryptedContent;
        } catch (error) {
          console.error('Failed to decrypt message:', error);
          newMessage.decrypted_content = '[Unable to decrypt message]';
        }

        setMessages(prev => [...prev, newMessage]);
      })
      .subscribe();
  };

  // Fetch messages for a room
  const fetchMessages = async (roomId: string) => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
      setLoading(false);
      return;
    }

    // Fetch profile data for all senders
    const senderIds = (data || []).map(message => message.sender_id);
    const uniqueSenderIds = [...new Set(senderIds)];
    
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', uniqueSenderIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    }

    // Decrypt messages and transform data
    const key = await getRoomEncryptionKey(roomId);
    const decryptedMessages = await Promise.all(
      (data || []).map(async (message) => {
        const senderProfile = (profilesData || []).find(p => p.id === message.sender_id);
        
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
            decrypted_content: '[Unable to decrypt message]',
            sender_profile: senderProfile ? {
              display_name: senderProfile.display_name || 'Unknown User',
              avatar_url: senderProfile.avatar_url
            } : { display_name: 'Unknown User' }
          };
        }
      })
    );

    setMessages(decryptedMessages);
    setLoading(false);
  };

  // Send message
  const sendMessage = async (content: string, type: 'text' | 'file' | 'image' = 'text') => {
    if (!user || !activeRoom || !content.trim()) return;

    setSending(true);
    try {
      // Encrypt message
      const key = await getRoomEncryptionKey(activeRoom.id);
      const encryptedContent = await ChatEncryption.encryptMessage(content, key);

      const { error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: activeRoom.id,
          sender_id: user.id,
          encrypted_content: encryptedContent,
          message_type: type,
        });

      if (error) throw error;

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Load chat rooms on mount
  useEffect(() => {
    if (user) {
      fetchChatRooms();
    }
  }, [user]);

  // Cleanup channels on unmount
  useEffect(() => {
    return () => {
      if (messagesChannel.current) {
        supabase.removeChannel(messagesChannel.current);
      }
    };
  }, []);

  return {
    chatRooms,
    activeRoom,
    messages,
    onlineUsers,
    loading,
    sending,
    startChatWithUser,
    setActiveRoomAndFetchMessages,
    sendMessage,
    fetchChatRooms,
    fetchOnlineUsers,
  };
}
