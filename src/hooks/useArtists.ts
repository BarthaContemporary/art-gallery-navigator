
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

export function useArtists() {
  return useQuery({
    queryKey: ['artists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('artists')
        .select('id, full_name');
      if (error) throw error;
      return data as Artist[];
    }
  });
}
