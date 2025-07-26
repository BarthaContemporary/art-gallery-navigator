/**
 * Hook for bulk deleting artworks
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Artwork } from "@/types/artwork";

export function useBulkDeleteArtworks() {
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  const deleteArtworksMutation = useMutation({
    mutationFn: async (artworkIds: string[]) => {
      const { error } = await supabase
        .from('artworks')
        .delete()
        .in('id', artworkIds);

      if (error) throw error;
      return artworkIds;
    },
    onSuccess: (deletedIds) => {
      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['artworks'] });
      queryClient.invalidateQueries({ queryKey: ['artwork-images'] });
      
      // Remove specific artwork queries from cache
      deletedIds.forEach(id => {
        queryClient.removeQueries({ queryKey: ['artwork', id] });
      });

      toast.success(`Successfully deleted ${deletedIds.length} artwork${deletedIds.length !== 1 ? 's' : ''}`);
    },
    onError: (error) => {
      console.error('Error deleting artworks:', error);
      toast.error("Failed to delete artworks. Please try again.");
    },
  });

  const bulkDeleteArtworks = async (artworks: Artwork[]) => {
    if (artworks.length === 0) return;

    setIsDeleting(true);
    try {
      await deleteArtworksMutation.mutateAsync(artworks.map(a => a.id));
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    bulkDeleteArtworks,
    isDeleting: isDeleting || deleteArtworksMutation.isPending,
  };
}