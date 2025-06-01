
import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChatMessage } from './types';
import { ChatEncryption } from '@/lib/encryption';

export function useChatMessages(userId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const encryptionKeys = useRef<Map<string, CryptoKey>>(new Map());
  const messagesChannel = useRef<any>(null);

  // Get or create encryption key for room
  const getRoomEncryptionKey = async (roomId: string): Promise<CryptoKey> => {
    if (!userId) throw new Error('User not authenticated');
    
    if (encryptionKeys.current.has(roomId)) {
      return encryptionKeys.current.get(roomId)!;
    }

    const key = await ChatEncryption.generateRoomKey(roomId, userId);
    encryptionKeys.current.set(roomId, key);
    return key;
  };

  // Decrypt a single message with profile data
  const decryptMessageWithProfile = async (message: any, key: CryptoKey, profilesMap: Map<string, any>) => {
    const senderProfile = profilesMap.get(message.sender_id);
    
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
  };

  // Fetch messages for a room
  const fetchMessages = async (roomId: string) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        toast.error('Failed to load messages');
        return;
      }

      if (!data || data.length === 0) {
        setMessages([]);
        return;
      }

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

      // Decrypt messages and transform data
      const key = await getRoomEncryptionKey(roomId);
      const decryptedMessages = await Promise.all(
        data.map(message => decryptMessageWithProfile(message, key, profilesMap))
      );

      setMessages(decryptedMessages);
    } catch (error) {
      console.error('Error in fetchMessages:', error);
      toast.error('Failed to load messages');
    }
  };

  // Send message
  const sendMessage = async (content: string, roomId: string, type: 'text' | 'file' | 'image' = 'text') => {
    if (!userId || !content.trim()) return;

    setSending(true);
    try {
      // Encrypt message
      const key = await getRoomEncryptionKey(roomId);
      const encryptedContent = await ChatEncryption.encryptMessage(content, key);

      const { error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_id: userId,
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

  // Set up real-time subscription for messages
  const subscribeToMessages = async (roomId: string) => {
    // Clean up existing subscription
    if (messagesChannel.current) {
      supabase.removeChannel(messagesChannel.current);
    }

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
          // Fetch sender profile for the new message
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .eq('id', newMessage.sender_id)
            .single();

          const profilesMap = new Map();
          if (senderProfile) {
            profilesMap.set(senderProfile.id, senderProfile);
          }

          // Decrypt the message with profile data
          const key = await getRoomEncryptionKey(roomId);
          const decryptedMessage = await decryptMessageWithProfile(newMessage, key, profilesMap);

          setMessages(prev => [...prev, decryptedMessage]);
        } catch (error) {
          console.error('Error handling real-time message:', error);
          // Add message without decryption as fallback
          setMessages(prev => [...prev, {
            ...newMessage,
            decrypted_content: '[Unable to decrypt message]',
            sender_profile: { display_name: 'Unknown User' }
          }]);
        }
      })
      .subscribe();
  };

  // Cleanup function
  const cleanup = () => {
    if (messagesChannel.current) {
      supabase.removeChannel(messagesChannel.current);
    }
  };

  return {
    messages,
    sending,
    fetchMessages,
    sendMessage,
    subscribeToMessages,
    cleanup,
  };
}
