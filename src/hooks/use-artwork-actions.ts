
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Artwork } from "@/hooks/use-artworks";

export function useArtworkActions(artwork: Artwork) {
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('artworks')
        .delete()
        .eq('id', artwork.id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['artworks'] });
      toast.success("Artwork deleted successfully");
      return true;
    } catch (error) {
      console.error('Error deleting artwork:', error);
      toast.error("Failed to delete artwork");
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      const artworkCopy = {
        title: `${artwork.title} (Copy)`,
        artist_id: artwork.artist_id,
        year: artwork.year,
        medium_type: artwork.medium_type,
        materials: artwork.materials,
        classification: artwork.classification,
        edition_size: artwork.edition_size,
        dimensions: artwork.dimensions,
        price: artwork.price,
        currency: artwork.currency,
        status: artwork.status,
        image_url: artwork.image_url,
        location_id: artwork.location_id,
        inventory_quantity: artwork.inventory_quantity,
        available_works: artwork.available_works,
        artist_proofs: artwork.artist_proofs,
        signature_type: artwork.signature_type,
        condition: artwork.condition,
        signature_details: artwork.signature_details,
        provenance: artwork.provenance,
        story: artwork.story,
        exhibition_history: artwork.exhibition_history,
        height: artwork.height,
        width: artwork.width,
        depth: artwork.depth,
        is_framed: artwork.is_framed,
        frame_height: artwork.frame_height,
        frame_width: artwork.frame_width,
        frame_depth: artwork.frame_depth,
        weight: artwork.weight,
        has_crate: artwork.has_crate,
        crate_height: artwork.crate_height,
        crate_width: artwork.crate_width,
        crate_depth: artwork.crate_depth,
      };

      const { error } = await supabase
        .from('artworks')
        .insert([artworkCopy]);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['artworks'] });
      toast.success("Artwork duplicated successfully");
      return true;
    } catch (error) {
      console.error('Error duplicating artwork:', error);
      toast.error("Failed to duplicate artwork");
      return false;
    }
  };

  return {
    isDeleting,
    handleDelete,
    handleDuplicate
  };
}
