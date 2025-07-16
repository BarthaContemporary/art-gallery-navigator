import { useState, useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Artwork } from "./use-artworks";

const ITEMS_PER_PAGE = 20;

export function usePaginatedArtworks() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [artistFilter, setArtistFilter] = useState<string | null>(null);

  const {
    data,
    error,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["artworks-paginated", searchTerm, statusFilter, typeFilter, artistFilter],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
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
          artwork_images(id, image_url, is_primary, display_order, thumbnail_url, medium_url, processed),
          artists(full_name)
        `)
        .order("created_at", { ascending: false })
        .range(pageParam * ITEMS_PER_PAGE, (pageParam + 1) * ITEMS_PER_PAGE - 1);

      // Apply filters
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,artists.full_name.ilike.%${searchTerm}%`);
      }
      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }
      if (typeFilter) {
        query = query.eq("medium_type", typeFilter);
      }
      if (artistFilter) {
        query = query.eq("artist_id", artistFilter);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error("Error fetching paginated artworks:", error);
        throw error;
      }
      
      // Map the artist name to artist_name for easier access
      const artworksWithArtistNames = data?.map(artwork => ({
        ...artwork,
        artist_name: artwork.artists?.full_name || null
      })) || [];
      
      return {
        artworks: artworksWithArtistNames as unknown as Artwork[],
        nextCursor: data?.length === ITEMS_PER_PAGE ? pageParam + 1 : null
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  // Flatten the pages into a single array
  const allArtworks = data?.pages.flatMap(page => page.artworks) || [];

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    artworks: allArtworks,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    loadMore,
    error,
    // Filter controls
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    artistFilter,
    setArtistFilter,
  };
}