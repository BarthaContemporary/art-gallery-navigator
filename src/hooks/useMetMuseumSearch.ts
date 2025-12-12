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

  const searchArtist = async (artistName: string) => {
    if (!artistName) return;

    setIsLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('met-museum-search', {
        body: { artistName },
      });

      // Silently handle errors - external APIs are unreliable
      if (fnError || !data) {
        console.info('MET Museum search unavailable');
        setObjects([]);
        setTotalObjects(0);
        return;
      }

      setObjects(data.objects || []);
      setTotalObjects(data.totalObjects || 0);
    } catch (err) {
      // Silently fail - don't show errors for external API issues
      console.info('MET Museum search error:', err);
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
