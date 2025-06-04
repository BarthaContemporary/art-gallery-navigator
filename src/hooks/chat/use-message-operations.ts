
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useMessageOperations(user: any, setState: any) {
  // Send message (plain text - no encryption)
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

    setState((prev: any) => ({ ...prev, sending: true, error: null }));

    try {
      console.log('Sending plain text message:', { content: content.substring(0, 50), roomId, userId: user.id, type });
      
      // Store plain text directly in encrypted_content field (field name kept for database compatibility)
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_id: user.id,
          encrypted_content: content, // Now storing plain text
          message_type: type,
        })
        .select()
        .single();

      if (error) {
        console.error('Database insert error:', error);
        throw error;
      }

      console.log('Message sent successfully:', data.id);
      toast.success('Message sent');

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
      setState((prev: any) => ({ ...prev, sending: false }));
    }
  }, [user, setState]);

  // Mark messages as read
  const markMessagesAsRead = useCallback(async (roomId: string) => {
    if (!user) return;

    try {
      // Get unread messages in the room
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('room_id', roomId)
        .not('read_by', 'cs', `{${user.id}}`);

      if (error) throw error;

      // Mark each message as read
      for (const message of messages || []) {
        await supabase.rpc('mark_message_as_read', {
          message_id: message.id,
          reader_id: user.id
        });
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [user]);

  // Clean up old messages
  const cleanupOldMessages = useCallback(async (activeRoom: any, fetchMessages: (roomId: string) => Promise<void>) => {
    try {
      await supabase.rpc('cleanup_old_chat_messages');
      toast.success('Old messages cleaned up');
      
      // Refresh current room messages if active
      if (activeRoom) {
        await fetchMessages(activeRoom.id);
      }
    } catch (error) {
      console.error('Error cleaning up old messages:', error);
      toast.error('Failed to cleanup old messages');
    }
  }, []);

  return {
    sendMessage,
    markMessagesAsRead,
    cleanupOldMessages,
  };
}
