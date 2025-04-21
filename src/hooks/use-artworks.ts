import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Artwork {
  id: string;
  title: string;
  artist_id: string | null;
  year: number | null;
  medium_type: string;
  materials: string | null;
  classification: string;
  edition_size: number | null;
  dimensions: string | null;
  price: number | null;
  currency: string;
  status: string | null;
  image_url: string | null;
  location_id: string | null;
  inventory_quantity: number | null;
  available_works: number | null;
  artist_proofs: number | null;
}

export function useArtworks() {
  return useQuery({
    queryKey: ["artworks"],
    queryFn: async (): Promise<Artwork[]> => {
      const { data, error } = await supabase
        .from("artworks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return data;
    },
  });
}
