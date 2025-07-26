/**
 * Hook for managing artwork selection state and bulk operations
 */

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import type { Artwork } from "@/types/artwork";

export function useArtworkSelection(artworks: Artwork[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const selectedArtworks = useMemo(() => {
    return artworks.filter(artwork => selectedIds.has(artwork.id));
  }, [artworks, selectedIds]);

  const selectedCount = selectedIds.size;
  const allSelected = artworks.length > 0 && selectedIds.size === artworks.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < artworks.length;

  const toggleSelection = useCallback((artworkId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(artworkId)) {
        newSet.delete(artworkId);
      } else {
        newSet.add(artworkId);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(artworks.map(artwork => artwork.id)));
  }, [artworks]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    clearSelection();
  }, [clearSelection]);

  const isSelected = useCallback((artworkId: string) => {
    return selectedIds.has(artworkId);
  }, [selectedIds]);

  return {
    selectedIds,
    selectedArtworks,
    selectedCount,
    allSelected,
    someSelected,
    isSelectionMode,
    toggleSelection,
    selectAll,
    clearSelection,
    enterSelectionMode,
    exitSelectionMode,
    isSelected,
  };
}