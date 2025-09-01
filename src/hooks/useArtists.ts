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

export function useArtists() {
  return useQuery({
    queryKey: ['artists'],
    queryFn: async () => {
      // Use public safe view to exclude sensitive contact information
      const { data, error } = await supabase
        .from('artists_public_safe')
        .select('id, full_name, surname_first_letter, representation_status')
        .order('surname_first_letter', { ascending: true })
        .order('full_name', { ascending: true });
      if (error) throw error;
      return data as Artist[];
    }
  });
}