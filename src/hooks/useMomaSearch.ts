import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MomaObject {
  objectId: string;
  title: string;
  artist: string;
  date: string;
  medium: string;
  department: string;
  thumbnailUrl: string;
  url: string;
}

export function useMomaSearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [objects, setObjects] = useState<MomaObject[]>([]);
  const [totalObjects, setTotalObjects] = useState(0);

  const searchArtist = async (artistName: string) => {
    if (!artistName) return;

    setIsLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('moma-search', {
        body: { artistName },
      });

      // Silently handle errors - external APIs are unreliable
      if (fnError || !data) {
        console.info('MoMA search unavailable');
        setObjects([]);
        setTotalObjects(0);
        return;
      }

      setObjects(data.objects || []);
      setTotalObjects(data.totalObjects || 0);
    } catch (err) {
      // Silently fail - don't show errors for external API issues
      console.info('MoMA search error:', err);
      setObjects([]);
      setTotalObjects(0);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    searchArtist,
    objects,
    totalObjects,
    isLoading,
  };
}
