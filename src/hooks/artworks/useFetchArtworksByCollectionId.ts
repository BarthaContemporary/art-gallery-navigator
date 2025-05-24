
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Artwork } from "@/hooks/use-artworks"; // Assuming Artwork type is defined here

export function useFetchArtworksByCollectionId(collectionId: string | undefined) {
  return useQuery<Artwork[], Error>({
    queryKey: ["artworksByCollection", collectionId],
    queryFn: async () => {
      if (!collectionId) return [];

      // 1. Fetch artwork_ids from collection_artworks
      const { data: collectionArtworks, error: collectionArtworksError } = await supabase
        .from("collection_artworks")
        .select("artwork_id")
        .eq("collection_id", collectionId);

      if (collectionArtworksError) {
        console.error("Error fetching collection_artworks:", collectionArtworksError);
        throw collectionArtworksError;
      }
      
      if (!collectionArtworks || collectionArtworks.length === 0) {
        return [];
      }

      const artworkIds = collectionArtworks.map(ca => ca.artwork_id);

      // 2. Fetch artworks with these IDs
      const { data: artworksData, error: artworksDataError } = await supabase
        .from("artworks")
        .select("*") // ArtworkCard handles fetching/displaying artist name via its own logic
        .in("id", artworkIds);
      
      if (artworksDataError) {
        console.error("Error fetching artworks:", artworksDataError);
        throw artworksDataError;
      }

      return (artworksData as Artwork[]) || [];
    },
    enabled: !!collectionId,
  });
}
