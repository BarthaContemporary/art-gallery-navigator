/**
 * Clean Artworks Data Hook
 * Simple, reliable data fetching for artworks
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Artwork, ArtworkImage, Artist } from "@/types/artwork";

// Re-export types for backward compatibility
export type { Artwork, ArtworkImage, Artist } from "@/types/artwork";

export function useArtworks() {
  return useQuery({
    queryKey: ['artworks'],
    queryFn: async (): Promise<Artwork[]> => {
      const { data, error } = await supabase
        .from('artworks')
        .select(`
          id,
          title,
          artist_id,
          year,
          medium_type,
          materials,
          classification,
          edition_size,
          inventory_quantity,
          available_works,
          artist_proofs,
          price,
          currency,
          status,
          image_url,
          dimensions,
          width,
          height,
          depth,
          condition,
          story,
          exhibition_history,
          provenance,
          location_id,
          signature_type,
          signature_details,
          is_framed,
          frame_height,
          frame_width,
          frame_depth,
          weight,
          has_crate,
          crate_height,
          crate_width,
          crate_depth,
          created_at,
          updated_at,
          artists!inner(
            full_name,
            surname_first_letter
          ),
          artwork_images(
            id,
            artwork_id,
            image_url,
            is_primary,
            display_order,
            thumbnail_url,
            medium_url,
            thumbnail_storage_path,
            medium_storage_path,
            original_storage_path,
            large_storage_path,
            processed,
            processing_status,
            created_at,
            updated_at
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching artworks:', error);
        throw error;
      }

      // Transform data to match our types
      return (data || []).map(artwork => ({
        ...artwork,
        artist_name: artwork.artists?.full_name || 'Unknown Artist',
        artwork_images: (artwork.artwork_images || []).sort((a, b) => {
          // Primary images first, then by display order
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
          return a.display_order - b.display_order;
        })
      }));
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useArtists() {
  return useQuery({
    queryKey: ['artists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('artists')
        .select(`
          id,
          full_name,
          surname_first_letter,
          user_id,
          representation_status
        `)
        .order('surname_first_letter', { ascending: true })
        .order('full_name', { ascending: true });

      if (error) {
        console.error('Error fetching artists:', error);
        throw error;
      }

      return data || [];
    },
    staleTime: 1000 * 60 * 15, // 15 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

export function useArtwork(id: string) {
  return useQuery({
    queryKey: ['artwork', id],
    queryFn: async (): Promise<Artwork | null> => {
      const { data, error } = await supabase
        .from('artworks')
        .select(`
          id,
          title,
          artist_id,
          year,
          medium_type,
          materials,
          classification,
          edition_size,
          inventory_quantity,
          available_works,
          artist_proofs,
          price,
          currency,
          status,
          image_url,
          dimensions,
          width,
          height,
          depth,
          condition,
          story,
          exhibition_history,
          provenance,
          location_id,
          signature_type,
          signature_details,
          is_framed,
          frame_height,
          frame_width,
          frame_depth,
          weight,
          has_crate,
          crate_height,
          crate_width,
          crate_depth,
          created_at,
          updated_at,
          artists!inner(
            full_name,
            surname_first_letter
          ),
          artwork_images(
            id,
            artwork_id,
            image_url,
            is_primary,
            display_order,
            thumbnail_url,
            medium_url,
            thumbnail_storage_path,
            medium_storage_path,
            original_storage_path,
            large_storage_path,
            processed,
            processing_status,
            created_at,
            updated_at
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching artwork:', error);
        throw error;
      }

      if (!data) return null;

      return {
        ...data,
        artist_name: data.artists?.full_name || 'Unknown Artist',
        artwork_images: (data.artwork_images || []).sort((a, b) => {
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
          return a.display_order - b.display_order;
        })
      };
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}
