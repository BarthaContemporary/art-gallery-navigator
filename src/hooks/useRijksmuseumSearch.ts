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

  const searchArtist = async (artistName: string) => {
    if (!artistName) return;

    setIsLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('rijksmuseum-search', {
        body: { artistName },
      });

      // Silently handle errors - external APIs are unreliable
      if (fnError || !data) {
        console.info('Rijksmuseum search unavailable');
        setObjects([]);
        setTotalObjects(0);
        return;
      }

      setObjects(data.objects || []);
      setTotalObjects(data.totalObjects || 0);
    } catch (err) {
      // Silently fail - don't show errors for external API issues
      console.info('Rijksmuseum search error:', err);
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
