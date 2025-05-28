
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
      .select(`
        *,
        profile:profiles(display_name, avatar_url)
      `)
      .eq('is_online', true)
      .neq('user_id', user.id);

    if (error) {
      console.error('Error fetching online users:', error);
      return;
    }

    setOnlineUsers(data || []);
  };

  // Fetch chat rooms
  const fetchChatRooms = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('chat_rooms')
      .select(`
        *,
        participant_1_profile:profiles!chat_rooms_participant_1_id_fkey(display_name, avatar_url),
        participant_2_profile:profiles!chat_rooms_participant_2_id_fkey(display_name, avatar_url)
      `)
      .or(`participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error fetching chat rooms:', error);
      toast.error('Failed to load chat rooms');
      setLoading(false);
      return;
    }

    setChatRooms(data || []);
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
        .select(`
          *,
          participant_1_profile:profiles!chat_rooms_participant_1_id_fkey(display_name, avatar_url),
          participant_2_profile:profiles!chat_rooms_participant_2_id_fkey(display_name, avatar_url)
        `)
        .eq('id', roomId)
        .single();

      if (roomError) throw roomError;

      // Update chat rooms list
      await fetchChatRooms();
      
      return roomData;
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
      .select(`
        *,
        sender_profile:profiles!chat_messages_sender_id_fkey(display_name, avatar_url)
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
      setLoading(false);
      return;
    }

    // Decrypt messages
    const key = await getRoomEncryptionKey(roomId);
    const decryptedMessages = await Promise.all(
      (data || []).map(async (message) => {
        try {
          const decryptedContent = await ChatEncryption.decryptMessage(message.encrypted_content, key);
          return { ...message, decrypted_content: decryptedContent };
        } catch (error) {
          console.error('Failed to decrypt message:', error);
          return { ...message, decrypted_content: '[Unable to decrypt message]' };
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
