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
  const [error, setError] = useState<string | null>(null);

  const searchArtist = async (artistName: string) => {
    if (!artistName) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('moma-search', {
        body: { artistName },
      });

      if (fnError) {
        throw fnError;
      }

      setObjects(data.objects || []);
      setTotalObjects(data.totalObjects || 0);
    } catch (err) {
      console.error('MoMA search error:', err);
      setError(err instanceof Error ? err.message : 'Failed to search MoMA');
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
