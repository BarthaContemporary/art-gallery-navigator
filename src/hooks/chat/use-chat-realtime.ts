
import { useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChatMessage } from './types';

export function useChatRealtime(user: any, setState: any) {
  const messagesChannel = useRef<any>(null);

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

            setState((prev: any) => ({ ...prev, messages: [...prev.messages, messageWithProfile] }));

            if (newMessage.sender_id !== user?.id) {
              toast.info(`New message from ${senderProfile?.display_name || 'Unknown User'}`);
              if (user) {
                await supabase.rpc('mark_message_as_read', {
                  message_id: newMessage.id,
                  reader_id: user.id
                });
              }
            }
          } catch (error) {
            console.error('Error handling real-time message:', error);
          }
        })
        .subscribe((status) => {
          setState((prev: any) => ({ ...prev, connected: status === 'SUBSCRIBED' }));
        });
    } catch (error) {
      console.error('Error subscribing to messages:', error);
      setState((prev: any) => ({ ...prev, error: 'Real-time connection failed' }));
    }
  }, [user, setState]);

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
