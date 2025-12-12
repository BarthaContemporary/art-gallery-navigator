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
  const [error, setError] = useState<string | null>(null);

  const searchArtist = async (artistName: string) => {
    if (!artistName) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('tate-search', {
        body: { artistName },
      });

      if (fnError) {
        throw fnError;
      }

      setObjects(data.objects || []);
      setTotalObjects(data.totalObjects || 0);
    } catch (err) {
      console.error('Tate search error:', err);
      setError(err instanceof Error ? err.message : 'Failed to search Tate');
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
    error,
  };
}
