
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Extended Artwork type for public collection view
export interface PublicArtwork {
  id: string;
  title: string;
  artist_id: string | null;
  year: number | null;
  medium_type: string;
  materials: string | null;
  price: number | null;
  currency: string;
  status: string | null;
  location_id: string | null;
  height: number | null;
  width: number | null;
  depth: number | null;
  is_framed: boolean | null;
  frame_height: number | null;
  frame_width: number | null;
  frame_depth: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  // Related data
  artist?: {
    id: string;
    full_name: string;
  } | null;
  artwork_images?: {
    id: string;
    image_url: string;
    is_primary: boolean;
    display_order: number;
    thumbnail_url?: string | null; // Added
    medium_url?: string | null;    // Added
  }[];
}

export function useFetchArtworksByCollectionId(collectionId: string | undefined) {
  return useQuery<PublicArtwork[], Error>({
    queryKey: ["artworksByCollection", collectionId],
    queryFn: async () => {
      console.log(`[useFetchArtworksByCollectionId] Hook called. collectionId: ${collectionId}`);
      if (!collectionId) {
        console.log("[useFetchArtworksByCollectionId] No collectionId provided, returning empty array.");
        return [];
      }

      console.log(`[useFetchArtworksByCollectionId] Fetching artwork_ids for collection_id: ${collectionId}`);
      // 1. Fetch artwork_ids from collection_artworks
      const { data: collectionArtworks, error: collectionArtworksError } = await supabase
        .from("collection_artworks")
        .select("artwork_id")
        .eq("collection_id", collectionId);

      if (collectionArtworksError) {
        console.error("[useFetchArtworksByCollectionId] Error fetching collection_artworks:", collectionArtworksError);
        throw collectionArtworksError;
      }
      
      console.log(`[useFetchArtworksByCollectionId] Found ${collectionArtworks?.length || 0} artwork associations in 'collection_artworks'.`);

      if (!collectionArtworks || collectionArtworks.length === 0) {
        console.log(`[useFetchArtworksByCollectionId] No artwork associations found for collection ${collectionId}, returning empty array.`);
        return [];
      }

      const artworkIds = collectionArtworks.map(ca => ca.artwork_id);
      console.log(`[useFetchArtworksByCollectionId] Extracted artwork IDs: ${artworkIds.join(', ')}`);

      // 2. Fetch artworks with related data (artist and images)
      console.log(`[useFetchArtworksByCollectionId] Fetching artwork details for ${artworkIds.length} ID(s).`);
      const { data: artworksData, error: artworksDataError } = await supabase
        .from("artworks")
        .select(`
          id,
          title,
          artist_id,
          year,
          medium_type,
          materials,
          price,
          currency,
          status,
          location_id,
          height,
          width,
          depth,
          is_framed,
          frame_height,
          frame_width,
          frame_depth,
          created_at,
          updated_at,
          artists!inner (
            id,
            full_name
          ),
          artwork_images (
            id,
            image_url,
            is_primary,
            display_order,
            thumbnail_url, 
            medium_url    
          )
        `)
        .in("id", artworkIds)
        .order("created_at", { ascending: false });
      
      if (artworksDataError) {
        console.error("[useFetchArtworksByCollectionId] Error fetching artworks:", artworksDataError);
        throw artworksDataError;
      }

      console.log(`[useFetchArtworksByCollectionId] Fetched ${artworksData?.length || 0} artworks from 'artworks' table.`);
      
      // Transform the data to match our PublicArtwork interface
      const result: PublicArtwork[] = (artworksData || []).map(artwork => ({
        ...artwork,
        artist: artwork.artists ? {
          id: artwork.artists.id,
          full_name: artwork.artists.full_name
        } : null
      }));
      
      console.log(`[useFetchArtworksByCollectionId] Returning ${result.length} artworks.`);
      return result;
    },
    enabled: !!collectionId,
  });
}

