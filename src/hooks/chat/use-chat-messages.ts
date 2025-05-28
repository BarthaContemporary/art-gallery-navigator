
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

  // Fetch messages for a room
  const fetchMessages = async (roomId: string) => {
    if (!userId) return;

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

    // Fetch profile data for all senders
    const senderIds = (data || []).map(message => message.sender_id);
    const uniqueSenderIds = [...new Set(senderIds)];
    
    if (uniqueSenderIds.length === 0) {
      setMessages([]);
      return;
    }

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
        
        // Decrypt the message
        try {
          const key = await getRoomEncryptionKey(roomId);
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
