import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SMKObject {
  id: string;
  title: string;
  artist: string;
  date: string;
  medium: string;
  imageUrl: string | null;
  url: string;
  collection: string;
}

export function useSMKSearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [objects, setObjects] = useState<SMKObject[]>([]);
  const [totalObjects, setTotalObjects] = useState(0);

  const searchArtist = async (artistName: string) => {
    if (!artistName) return;

    setIsLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('smk-search', {
        body: { artistName },
      });

      if (fnError || !data) {
        console.info('SMK search unavailable');
        setObjects([]);
        setTotalObjects(0);
        return;
      }

      setObjects(data.objects || []);
      setTotalObjects(data.totalObjects || 0);
    } catch (err) {
      console.info('SMK search error:', err);
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
