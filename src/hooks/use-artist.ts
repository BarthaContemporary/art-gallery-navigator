
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Artist {
  id: string;
  full_name: string;
  biography: string | null;
  nationality: string | null;
  birth_year: number | null;
  image_url: string | null;
  representation_status: string;
}

export function useArtist(artistId: string | null) {
  return useQuery({
    queryKey: ["artist", artistId],
    queryFn: async (): Promise<Artist | null> => {
      if (!artistId) return null;
      
      const { data, error } = await supabase
        .from("artists")
        .select("*")
        .eq("id", artistId)
        .single();

      if (error) {
        throw error;
      }

      return data as Artist;
    },
    enabled: !!artistId,
  });
}
