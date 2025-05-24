
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Add surname_first_letter to the query and the return type expectation
export function useArtists() {
  return useQuery({
    queryKey: ['artists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('artists')
        .select('id, full_name, surname_first_letter'); // Added surname_first_letter
      if (error) throw error;
      // Explicitly type the return if needed, or rely on inference
      return data as { id: string; full_name: string; surname_first_letter: string | null }[];
    }
  });
}
