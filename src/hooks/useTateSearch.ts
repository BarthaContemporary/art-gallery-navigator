import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TateObject {
  id: string;
  accessionNumber: string;
  title: string;
  artist: string;
  artistId: string;
  date: string;
  year: string;
  medium: string;
  creditLine: string;
  thumbnailUrl: string;
  url: string;
}

export function useTateSearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [objects, setObjects] = useState<TateObject[]>([]);
  const [totalObjects, setTotalObjects] = useState(0);

  const searchArtist = async (artistName: string) => {
    if (!artistName) return;

    setIsLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('tate-search', {
        body: { artistName },
      });

      // Silently handle errors - external APIs are unreliable
      if (fnError || !data) {
        console.info('Tate search unavailable');
        setObjects([]);
        setTotalObjects(0);
        return;
      }

      setObjects(data.objects || []);
      setTotalObjects(data.totalObjects || 0);
    } catch (err) {
      // Silently fail - don't show errors for external API issues
      console.info('Tate search error:', err);
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
