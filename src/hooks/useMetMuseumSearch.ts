import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MetObject {
  objectID: number;
  title: string;
  artistDisplayName: string;
  objectDate: string;
  medium: string;
  primaryImage: string;
  primaryImageSmall: string;
  department: string;
  objectURL: string;
  classification: string;
}

export function useMetMuseumSearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [objects, setObjects] = useState<MetObject[]>([]);
  const [totalObjects, setTotalObjects] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const searchArtist = async (artistName: string) => {
    if (!artistName) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('met-museum-search', {
        body: { artistName },
      });

      if (fnError) {
        throw fnError;
      }

      setObjects(data.objects || []);
      setTotalObjects(data.totalObjects || 0);
    } catch (err) {
      console.error('MET Museum search error:', err);
      setError(err instanceof Error ? err.message : 'Failed to search MET Museum');
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
