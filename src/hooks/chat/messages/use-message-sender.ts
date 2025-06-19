
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useMessageSender(userId?: string) {
  const sendMessage = useCallback(async (
    content: string, 
    roomId: string, 
    type: 'text' | 'file' | 'image' = 'text'
  ) => {
    if (!userId || !content.trim()) {
      console.error('Missing userId or empty content');
      toast.error('Cannot send empty message');
      return;
    }

    if (!roomId) {
      console.error('Missing roomId for sendMessage');
      toast.error('Invalid chat room');
      return;
    }

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
      toast.success('Message sent');

      return data;
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
    }
  }, [userId]);

  return {
    sendMessage,
  };
}
