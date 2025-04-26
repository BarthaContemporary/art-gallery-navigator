import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Artwork {
  id: string;
  title: string;
  artist_id: string | null;
  year: number | null;
  medium_type: "Painting" | "Sculpture" | "Photography" | "Work on Paper" | "Installation" | "Video" | "Textile Arts" | "Book";
  materials: string | null;
  classification: string;
  edition_size: number | null;
  dimensions: string | null;
  price: number | null;
  currency: "USD" | "GBP" | "EUR" | "CHF";
  status: string | null;
  image_url: string | null;
  location_id: string | null;
  inventory_quantity: number | null;
  available_works: string | null; // Changed from number to string
  artist_proofs: number | null;
  signature_type: "not signed" | "hand-signed by artist" | "signed on plate" | "stamped by artist's estate" | "sticker label" | "other" | null;
  condition: string | null;
  signature_details: string | null;
  provenance: string | null;
  story: string | null;
  exhibition_history: string | null;
  height?: number | null;
  width?: number | null;
  depth?: number | null;
  // New properties for framing, crate and weight
  is_framed?: boolean | null;
  frame_height?: number | null;
  frame_width?: number | null;
  frame_depth?: number | null;
  weight?: number | null;
  has_crate?: boolean | null;
  crate_height?: number | null;
  crate_width?: number | null;
  crate_depth?: number | null;
  // Add the artist_name property for use in PDF generation and previews
  artist_name?: string;
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

      // Cast the data to Artwork[] to ensure TypeScript sees it as the correct type
      return data as unknown as Artwork[];
    },
  });
}
