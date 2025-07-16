import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Updated ArtworkImage interface to include storage paths
export interface ArtworkImage {
  id: string;
  artwork_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
  processed?: boolean;
  thumbnail_url?: string | null;
  medium_url?: string | null;
  // Add the missing storage path properties
  medium_storage_path?: string | null;
  large_storage_path?: string | null;
  thumbnail_storage_path?: string | null;
  original_storage_path?: string | null;
}

export interface Artwork {
  id: string;
  title: string;
  artist_id: string | null;
  year: number | null;
  medium_type: "Painting" | "Sculpture" | "Photography" | "Work on Paper" | "Installation" | "Video" | "Textile Arts" | "Book";
  materials: string | null;
  classification: string;
  edition_size: number | null;
  dimensions: string |null;
  price: number | null;
  currency: "USD" | "GBP" | "EUR" | "CHF";
  status: string | null;
  image_url: string | null; // This is the main/fallback image_url
  location_id: string | null;
  inventory_quantity: number | null;
  available_works: string | null;
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
  is_framed?: boolean | null;
  frame_height?: number | null;
  frame_width?: number | null;
  frame_depth?: number | null;
  weight?: number | null;
  has_crate?: boolean | null;
  crate_height?: number | null;
  crate_width?: number | null;
  crate_depth?: number | null;
  artist_name?: string;
  created_at?: string | null;
  updated_at?: string | null;
  artwork_images?: ArtworkImage[]; // Add the artwork_images array
  artists?: {
    full_name: string;
  };
}

// Lightweight artworks query for grid view
export function useArtworks() {
  return useQuery({
    queryKey: ["artworks"],
    queryFn: async (): Promise<Artwork[]> => {
      const { data, error } = await supabase
        .from("artworks")
        .select(`
          id,
          title,
          artist_id,
          year,
          medium_type,
          materials,
          classification,
          price,
          currency,
          status,
          image_url,
          created_at,
          updated_at,
          artwork_images(id, image_url, is_primary, display_order, thumbnail_url, medium_url, thumbnail_storage_path, medium_storage_path, processed),
          artists(full_name)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching artworks:", error);
        throw error;
      }
      
      // Map the artist name to artist_name for easier access
      const artworksWithArtistNames = data?.map(artwork => ({
        ...artwork,
        artist_name: artwork.artists?.full_name || null
      })) || [];
      
      return artworksWithArtistNames as unknown as Artwork[];
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

export function useArtwork(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['artworks', id],
    queryFn: async (): Promise<Artwork> => {
      const { data, error } = await supabase
        .from("artworks")
        .select(`
          *,
          artwork_images(*),
          artists(full_name)
        `)
        .eq("id", id)
        .single();

      if (error) {
        console.error(`Error fetching artwork ${id}:`, error);
        throw error;
      }
      
      // Map the artist name to artist_name for easier access
      const artworkWithArtistName = {
        ...data,
        artist_name: data.artists?.full_name || null
      };
      
      return artworkWithArtistName as unknown as Artwork;
    },
    enabled: !!id,
    initialData: () => {
      const artworks = queryClient.getQueryData<Artwork[]>(['artworks']);
      return artworks?.find(d => d.id === id);
    },
    initialDataUpdatedAt: () => 
      queryClient.getQueryState(['artworks'])?.dataUpdatedAt,
  });
}
