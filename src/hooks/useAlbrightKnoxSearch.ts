import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AlbrightKnoxObject {
  id: string;
  title: string;
  artist: string;
  date?: string;
  medium?: string;
  imageUrl?: string;
  url: string;
  location: string;
}

export function useAlbrightKnoxSearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [objects, setObjects] = useState<AlbrightKnoxObject[]>([]);
  const [totalObjects, setTotalObjects] = useState(0);

  const searchArtist = async (artistName: string) => {
    if (!artistName) return;

    setIsLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('albright-knox-search', {
        body: { artistName },
      });

      if (fnError || !data) {
        console.info('Buffalo AKG search unavailable');
        setObjects([]);
        setTotalObjects(0);
        return;
      }

      setObjects(data.objects || []);
      setTotalObjects(data.objects?.length || 0);
    } catch (err) {
      console.info('Buffalo AKG search error:', err);
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
