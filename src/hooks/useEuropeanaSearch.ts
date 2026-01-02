import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface EuropeanaObject {
  id: string;
  title: string;
  artist: string;
  date: string;
  medium: string;
  imageUrl: string | null;
  url: string;
  collection: string;
}

export function useEuropeanaSearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [objects, setObjects] = useState<EuropeanaObject[]>([]);
  const [totalObjects, setTotalObjects] = useState(0);

  const searchArtist = async (artistName: string) => {
    if (!artistName) return;

    setIsLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('europeana-search', {
        body: { artistName },
      });

      if (fnError || !data) {
        console.info('Europeana search unavailable');
        setObjects([]);
        setTotalObjects(0);
        return;
      }

      setObjects(data.objects || []);
      setTotalObjects(data.totalObjects || 0);
    } catch (err) {
      console.info('Europeana search error:', err);
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
