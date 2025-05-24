
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Artwork } from "@/hooks/use-artworks"; // Assuming Artwork type is defined here

export function useFetchArtworksByCollectionId(collectionId: string | undefined) {
  return useQuery<Artwork[], Error>({
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

      // 2. Fetch artworks with these IDs
      console.log(`[useFetchArtworksByCollectionId] Fetching artwork details for ${artworkIds.length} ID(s).`);
      const { data: artworksData, error: artworksDataError } = await supabase
        .from("artworks")
        .select("*") // ArtworkCard handles fetching/displaying artist name via its own logic
        .in("id", artworkIds);
      
      if (artworksDataError) {
        console.error("[useFetchArtworksByCollectionId] Error fetching artworks:", artworksDataError);
        throw artworksDataError;
      }

      console.log(`[useFetchArtworksByCollectionId] Fetched ${artworksData?.length || 0} artworks from 'artworks' table.`);
      
      const result = (artworksData as Artwork[]) || [];
      console.log(`[useFetchArtworksByCollectionId] Returning ${result.length} artworks.`);
      return result;
    },
    enabled: !!collectionId,
  });
}
