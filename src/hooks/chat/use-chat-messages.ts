
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
      // First, cleanup old messages (older than 1 week)
      await supabase.rpc('cleanup_old_chat_messages');

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Only messages from last week
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

      // Transform messages with profile data
      const transformedMessages = data.map(message => {
        const senderProfile = profilesMap.get(message.sender_id);
        
        return {
          ...message,
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

  // Send message (support text and image types)
  const sendMessage = async (content: string, roomId: string, type: 'text' | 'file' | 'image' = 'text') => {
    if (!userId || !content.trim()) {
      console.error('Missing userId or empty content');
      return;
    }

    setSending(true);
    
    try {
      console.log('Sending message:', { content: content.substring(0, 50), roomId, userId, type });
      
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

  // Mark messages as read and update counters
  const markMessagesAsRead = async (roomId: string) => {
    if (!userId) return;

    try {
      const { data: unreadMessages, error } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('room_id', roomId)
        .not('read_by', 'cs', `{${userId}}`);

      if (error) throw error;

      for (const message of unreadMessages || []) {
        await supabase.rpc('mark_message_as_read', {
          message_id: message.id,
          reader_id: userId
        });
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
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

          // Transform message with profile data
          const transformedMessage = {
            ...newMessage,
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
            sender_profile: { display_name: 'Unknown User' }
          }]);
        }
      })
      .subscribe();
  };

  // Get unread count for a specific room
  const getUnreadCount = async (roomId: string): Promise<number> => {
    if (!userId) return 0;

    try {
      const { count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomId)
        .neq('sender_id', userId)
        .not('read_by', 'cs', `{${userId}}`);

      return count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  };

  // Get total unread count across all rooms
  const getTotalUnreadCount = async (): Promise<number> => {
    if (!userId) return 0;

    try {
      const { count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .neq('sender_id', userId)
        .not('read_by', 'cs', `{${userId}}`);

      return count || 0;
    } catch (error) {
      console.error('Error getting total unread count:', error);
      return 0;
    }
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
    markMessagesAsRead,
    getUnreadCount,
    getTotalUnreadCount,
    cleanup,
    clearCache,
  };
}
