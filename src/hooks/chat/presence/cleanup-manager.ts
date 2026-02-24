import { useRef, useCallback } from 'react';
import { getRestUrl, getSupabaseAnonKey } from '@/lib/supabase-url';

export function useCleanupManager(currentUserId?: string) {
  const beforeUnloadListener = useRef<((event: BeforeUnloadEvent) => void) | null>(null);

  const setupBeforeUnloadListener = useCallback(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (currentUserId) {
        // Use sendBeacon for reliable offline status update
        const payload = JSON.stringify({
          user_id: currentUserId,
          is_online: false,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // Try sendBeacon first, fallback to fetch with keepalive
        if (navigator.sendBeacon) {
          const url = getRestUrl('user_presence');
          const headers = {
            'Content-Type': 'application/json',
            'apikey': getSupabaseAnonKey(),
            'Prefer': 'resolution=merge-duplicates'
          };
          
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon(url, blob);
        } else {
          // Fallback to fetch with keepalive
          fetch(getRestUrl('user_presence'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': getSupabaseAnonKey(),
              'Prefer': 'resolution=merge-duplicates'
            },
            body: payload,
            keepalive: true
          }).catch(console.error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    beforeUnloadListener.current = handleBeforeUnload;
  }, [currentUserId]);

  const cleanupBeforeUnloadListener = useCallback(() => {
    if (beforeUnloadListener.current) {
      window.removeEventListener('beforeunload', beforeUnloadListener.current);
      beforeUnloadListener.current = null;
    }
  }, []);

  return {
    setupBeforeUnloadListener,
    cleanupBeforeUnloadListener
  };
}
