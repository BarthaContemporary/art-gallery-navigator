
import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChatMessage } from './types';
import { NotificationService } from '@/services/notification-service';

export function useChatMessages(userId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const messagesChannel = useRef<any>(null);

  // Fetch messages for a room (plain text - no decryption needed)
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

      // Transform messages with profile data (encrypted_content field now contains plain text)
      const transformedMessages = data.map(message => {
        const senderProfile = profilesMap.get(message.sender_id);
        
        return {
          ...message,
          decrypted_content: message.encrypted_content, // encrypted_content now contains plain text
          content: message.encrypted_content, // Also set content for compatibility
          sender_profile: senderProfile ? {
            display_name: senderProfile.display_name || 'Unknown User',
            avatar_url: senderProfile.avatar_url
          } : { display_name: 'Unknown User' }
        };
      });

      setMessages(transformedMessages);
    } catch (error) {
      console.error('Error in fetchMessages:', error);
      toast.error('Failed to load messages');
    }
  };

  // Send message (plain text - no encryption)
  const sendMessage = async (content: string, roomId: string, type: 'text' | 'file' | 'image' = 'text') => {
    if (!userId || !content.trim()) {
      console.error('Missing userId or empty content');
      return;
    }

    setSending(true);
    
    try {
      console.log('Sending message:', { content: content.substring(0, 50), roomId, userId });
      
      // Store plain text directly in encrypted_content field (field name kept for database compatibility)
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_id: userId,
          encrypted_content: content, // Now storing plain text
          message_type: type,
        })
        .select()
        .single();

      if (error) {
        console.error('Database insert error:', error);
        throw error;
      }

      console.log('Message sent successfully:', data);

    } catch (error) {
      console.error('Error sending message:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          toast.error('You do not have permission to send messages to this room.');
        } else {
          toast.error(`Failed to send message: ${error.message}`);
        }
      } else {
        toast.error('Failed to send message. Please try again.');
      }
      
      throw error;
    } finally {
      setSending(false);
    }
  };

  // Set up real-time subscription for messages (plain text - no decryption needed)
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

          // Transform message with profile data (encrypted_content field now contains plain text)
          const transformedMessage = {
            ...newMessage,
            decrypted_content: newMessage.encrypted_content, // encrypted_content now contains plain text
            content: newMessage.encrypted_content, // Also set content for compatibility
            sender_profile: senderProfile ? {
              display_name: senderProfile.display_name || 'Unknown User',
              avatar_url: senderProfile.avatar_url
            } : { display_name: 'Unknown User' }
          };

          setMessages(prev => [...prev, transformedMessage]);

          // Show notification if message is from another user
          if (newMessage.sender_id !== userId) {
            const notificationService = NotificationService.getInstance();
            const senderName = senderProfile?.display_name || 'Unknown User';
            const messageContent = newMessage.encrypted_content || 'New message';
            
            // Show in-app notification
            notificationService.showInAppNotification(
              'New Message',
              messageContent,
              senderName
            );

            // Show push notification if the app is in background or not on chat page
            if (document.hidden || !window.location.pathname.includes('/chat')) {
              notificationService.showPushNotification(
                `Message from ${senderName}`,
                messageContent,
                { roomId, senderId: newMessage.sender_id }
              );
            }
          }
        } catch (error) {
          console.error('Error handling real-time message:', error);
          // Add message without full processing as fallback
          setMessages(prev => [...prev, {
            ...newMessage,
            decrypted_content: newMessage.encrypted_content || '[Message could not be processed]',
            content: newMessage.encrypted_content || '[Message could not be processed]',
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

  // Clear cache function
  const clearCache = () => {
    setMessages([]);
    
    // Remove any active message subscriptions
    if (messagesChannel.current) {
      supabase.removeChannel(messagesChannel.current);
      messagesChannel.current = null;
    }
  };

  return {
    messages,
    sending,
    fetchMessages,
    sendMessage,
    subscribeToMessages,
    cleanup,
    clearCache,
  };
}
