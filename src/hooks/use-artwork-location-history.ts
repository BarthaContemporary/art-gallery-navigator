
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ArtworkLocationHistory {
  id: string;
  artwork_id: string;
  location_id: string | null;
  previous_location_id: string | null;
  changed_at: string;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
  location?: { name: string };
  previous_location?: { name: string };
}

export function useArtworkLocationHistory(artworkId: string) {
  return useQuery({
    queryKey: ["artwork-location-history", artworkId],
    queryFn: async (): Promise<ArtworkLocationHistory[]> => {
      const { data, error } = await supabase
        .from("artwork_location_history")
        .select(`
          *,
          location:locations!artwork_location_history_location_id_fkey(name),
          previous_location:locations!artwork_location_history_previous_location_id_fkey(name)
        `)
        .eq("artwork_id", artworkId)
        .order("changed_at", { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    },
    enabled: !!artworkId,
  });
}
