
import { useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage } from '../types';
import { NotificationService } from '@/services/notification-service';

export function useMessageRealtime(userId?: string, onNewMessage?: (message: ChatMessage) => void) {
  const messagesChannel = useRef<any>(null);

  const subscribeToMessages = useCallback(async (roomId: string) => {
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

          // Notify parent component
          if (onNewMessage) {
            onNewMessage(transformedMessage);
          }

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
          if (onNewMessage) {
            onNewMessage({
              ...newMessage,
              sender_profile: { display_name: 'Unknown User' }
            });
          }
        }
      })
      .subscribe();
  }, [userId, onNewMessage]);

  const cleanup = useCallback(() => {
    if (messagesChannel.current) {
      supabase.removeChannel(messagesChannel.current);
      messagesChannel.current = null;
    }
  }, []);

  return {
    subscribeToMessages,
    cleanup,
  };
}
