import { useRef, useCallback } from 'react';

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
          const url = 'https://cvhdspyugfcvkrufqzrq.supabase.co/rest/v1/user_presence';
          const headers = {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2aGRzcHl1Z2ZjdmtydWZxenJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5ODkxOTIsImV4cCI6MjA2MDU2NTE5Mn0.NT2RKvxlHAuzTDXg9u2K4zq65dNnqfnKTxjpeMDeN6Y',
            'Prefer': 'resolution=merge-duplicates'
          };
          
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon(url, blob);
        } else {
          // Fallback to fetch with keepalive
          fetch('https://cvhdspyugfcvkrufqzrq.supabase.co/rest/v1/user_presence', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2aGRzcHl1Z2ZjdmtydWZxenJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5ODkxOTIsImV4cCI6MjA2MDU2NTE5Mn0.NT2RKvxlHAuzTDXg9u2K4zq65dNnqfnKTxjpeMDeN6Y',
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
