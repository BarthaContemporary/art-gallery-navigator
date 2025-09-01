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
  surname_first_letter: string | null;
  user_id?: string;
}

export function useArtist(artistId: string | null) {
  return useQuery({
    queryKey: ["artist", artistId],
    queryFn: async (): Promise<Artist | null> => {
      if (!artistId) return null;
      
      // Use public safe view to exclude sensitive contact information
      const { data, error } = await supabase
        .from("artists_public_safe")
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