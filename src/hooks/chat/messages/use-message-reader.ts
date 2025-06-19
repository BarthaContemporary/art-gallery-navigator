
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useMessageReader(userId?: string) {
  const markMessagesAsRead = useCallback(async (roomId: string) => {
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
  }, [userId]);

  const getUnreadCount = useCallback(async (roomId: string): Promise<number> => {
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
  }, [userId]);

  const getTotalUnreadCount = useCallback(async (): Promise<number> => {
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
  }, [userId]);

  return {
    markMessagesAsRead,
    getUnreadCount,
    getTotalUnreadCount,
  };
}
