
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChatMessage } from './types';

export function useMessageOperations(user: any, setState: any) {
  // Mark messages as read when viewing them
  const markMessagesAsRead = useCallback(async (roomId: string) => {
    if (!user) return;

    try {
      const { data: unreadMessages } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('room_id', roomId)
        .not('sender_id', 'eq', user.id)
        .or(`read_by.is.null,not.read_by.cs.{${user.id}}`);

      if (unreadMessages && unreadMessages.length > 0) {
        for (const message of unreadMessages) {
          await supabase.rpc('mark_message_as_read', {
            message_id: message.id,
            reader_id: user.id
          });
        }
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [user]);

  // Clean up old messages
  const cleanupOldMessages = useCallback(async (activeRoom: any, fetchMessages: any) => {
    if (!user) return;

    try {
      setState((prev: any) => ({ ...prev, loading: true }));
      
      const { error } = await supabase.rpc('cleanup_old_chat_messages');
      
      if (error) {
        console.error('Error cleaning up old messages:', error);
        toast.error('Failed to cleanup old messages');
      } else {
        toast.success('Old messages cleaned up successfully');
        if (activeRoom) {
          await fetchMessages(activeRoom.id);
        }
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
      toast.error('Failed to cleanup old messages');
    } finally {
      setState((prev: any) => ({ ...prev, loading: false }));
    }
  }, [user, setState]);

  // Send message (plain text - no encryption)
  const sendMessage = useCallback(async (content: string, roomId: string, type: 'text' | 'file' | 'image' = 'text') => {
    if (!user || !content.trim()) {
      toast.error('Cannot send empty message');
      return;
    }

    if (!roomId) {
      toast.error('Invalid chat room');
      return;
    }

    setState((prev: any) => ({ ...prev, sending: true, error: null }));

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_id: user.id,
          encrypted_content: content, // Storing as plain text (field name kept for compatibility)
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
      toast.error('Failed to send message');
    } finally {
      setState((prev: any) => ({ ...prev, sending: false }));
    }
  }, [user, setState]);

  return {
    markMessagesAsRead,
    cleanupOldMessages,
    sendMessage,
  };
}
