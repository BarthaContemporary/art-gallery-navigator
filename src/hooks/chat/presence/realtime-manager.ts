
import { useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useRealtimeManager(currentUserId?: string, onUpdate?: () => void) {
  const presenceChannel = useRef<any>(null);

  const setupRealtimeSubscription = useCallback(() => {
    if (!currentUserId) return;

    console.log('Setting up real-time subscription for presence');

    presenceChannel.current = supabase
      .channel('user_presence_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_presence'
      }, (payload) => {
        console.log('Real-time presence update:', payload);
        if (onUpdate) onUpdate();
      })
      .subscribe((status) => {
        console.log('Presence subscription status:', status);
      });
  }, [currentUserId, onUpdate]);

  const cleanupRealtimeSubscription = useCallback(() => {
    if (presenceChannel.current) {
      supabase.removeChannel(presenceChannel.current);
      presenceChannel.current = null;
    }
  }, []);

  return {
    setupRealtimeSubscription,
    cleanupRealtimeSubscription
  };
}
