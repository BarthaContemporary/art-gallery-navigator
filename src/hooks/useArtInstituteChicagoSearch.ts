import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AICObject {
  id: number;
  title: string;
  artistDisplay: string;
  dateDisplay: string;
  medium: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  department: string;
  url: string;
}

export function useArtInstituteChicagoSearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [objects, setObjects] = useState<AICObject[]>([]);
  const [totalObjects, setTotalObjects] = useState(0);

  const searchArtist = async (artistName: string) => {
    if (!artistName) return;

    setIsLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('art-institute-chicago-search', {
        body: { artistName },
      });

      if (fnError || !data) {
        console.info('Art Institute of Chicago search unavailable');
        setObjects([]);
        setTotalObjects(0);
        return;
      }

      setObjects(data.objects || []);
      setTotalObjects(data.totalObjects || 0);
    } catch (err) {
      console.info('Art Institute of Chicago search error:', err);
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
