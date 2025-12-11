import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RijksmuseumObject {
  id: string;
  title: string;
  creator: string;
  date: string;
  description: string;
  imageUrl: string | null;
}

export interface RijksmuseumSearchResult {
  objects: RijksmuseumObject[];
  totalObjects: number;
}

export function useRijksmuseumSearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [objects, setObjects] = useState<RijksmuseumObject[]>([]);
  const [totalObjects, setTotalObjects] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const searchArtist = async (artistName: string) => {
    if (!artistName) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('rijksmuseum-search', {
        body: { artistName },
      });

      if (fnError) {
        throw fnError;
      }

      setObjects(data.objects || []);
      setTotalObjects(data.totalObjects || 0);
    } catch (err) {
      console.error('Rijksmuseum search error:', err);
      setError(err instanceof Error ? err.message : 'Failed to search Rijksmuseum');
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
