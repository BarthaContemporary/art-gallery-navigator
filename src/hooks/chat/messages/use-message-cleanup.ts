
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useMessageCleanup() {
  const cleanupOldMessages = useCallback(async (daysToKeep: number = 30) => {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (error) throw error;
      
      toast.success(`Messages older than ${daysToKeep} days have been cleaned up`);
    } catch (error) {
      console.error('Error cleaning up old messages:', error);
      toast.error('Failed to cleanup old messages');
    }
  }, []);

  return {
    cleanupOldMessages,
  };
}
