import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface HarvardObject {
  id: number;
  title: string;
  dated?: string;
  medium?: string;
  classification?: string;
  primaryImageUrl?: string;
  url?: string;
  creditLine?: string;
  dimensions?: string;
  people?: string[];
}

export interface HarvardArtist {
  id: number;
  name: string;
  culture?: string;
  birthplace?: string;
  deathplace?: string;
  displaydate?: string;
  objectcount?: number;
  url?: string;
}

interface HarvardSearchResult {
  success: boolean;
  objects?: HarvardObject[];
  artists?: HarvardArtist[];
  totalObjects?: number;
  totalArtists?: number;
  error?: string;
}

export function useHarvardMuseumSearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [objects, setObjects] = useState<HarvardObject[]>([]);
  const [artists, setArtists] = useState<HarvardArtist[]>([]);
  const [totalObjects, setTotalObjects] = useState(0);

  const searchArtist = useCallback(async (artistName: string) => {
    if (!artistName) return;
    
    setIsLoading(true);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke<HarvardSearchResult>(
        "harvard-museum-search",
        { body: { artistName } }
      );

      // Silently handle errors - external APIs are unreliable
      if (fnError || !data) {
        console.info('Harvard Museum search unavailable');
        setObjects([]);
        setArtists([]);
        setTotalObjects(0);
        return;
      }

      if (data.success) {
        setObjects(data.objects || []);
        setArtists(data.artists || []);
        setTotalObjects(data.totalObjects || 0);
      } else {
        setObjects([]);
        setArtists([]);
        setTotalObjects(0);
      }
    } catch (err) {
      // Silently fail - don't show errors for external API issues
      console.info("Harvard Museum search error:", err);
      setObjects([]);
      setArtists([]);
      setTotalObjects(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { searchArtist, objects, artists, totalObjects, isLoading };
}
