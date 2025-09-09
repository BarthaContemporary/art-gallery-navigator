/**
 * Optimized Artwork Card - High Performance Version
 * Uses global dialog manager and eliminates per-card dialog instances
 */

import React, { memo, useState, useCallback } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { useDialogManager } from "@/hooks/use-dialog-manager";
import { useArtworkActions } from "@/hooks/use-artwork-actions";
import { useArtworkPreloader } from "@/hooks/use-artwork-preloader";
import { ArtworkCardImage } from "./ArtworkCardImage";
import { ArtworkCardInfo } from "./ArtworkCardInfo";
import { cn } from "@/lib/utils";

interface OptimizedArtworkCardProps {
  artwork: Artwork;
  disabled?: boolean;
  index?: number;
}

const OptimizedArtworkCardComponent = ({ 
  artwork, 
  disabled = false,
  index = 0 
}: OptimizedArtworkCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const { showArtworkOverview, showArtworkEdit, showArtworkDelete } = useDialogManager();
  const { handleDuplicate: duplicateArtwork } = useArtworkActions(artwork);
  const { observeArtwork } = useArtworkPreloader({
    artworks: [artwork],
    currentIndex: index,
    preloadCount: 3,
    enabled: true
  });

  // Use artwork name from the artwork data (already included in query)
  const artistName = artwork.artist_name || "Unknown Artist";
  const available = (artwork.status || "available").toLowerCase() === "available";

  const handleView = useCallback(() => {
    if (disabled) return;
    showArtworkOverview(artwork);
  }, [disabled, showArtworkOverview, artwork]);

  const handleEdit = useCallback((e?: React.MouseEvent) => {
    if (disabled) return;
    e?.stopPropagation();
    showArtworkEdit(artwork);
  }, [disabled, showArtworkEdit, artwork]);

  const handleDelete = useCallback(() => {
    if (disabled) return;
    showArtworkDelete(artwork);
  }, [disabled, showArtworkDelete, artwork]);

  const handleDuplicate = useCallback((e?: React.MouseEvent) => {
    if (disabled) return;
    e?.stopPropagation();
    duplicateArtwork(e);
  }, [disabled, duplicateArtwork]);

  const handleExport = useCallback((e?: React.MouseEvent) => {
    if (disabled) return;
    e?.stopPropagation();
    // TODO: Implement export functionality
  }, [disabled]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  return (
    <div 
      className={cn(
        "group relative flex flex-col border rounded-lg bg-card hover:shadow-md transition-all duration-200 overflow-hidden",
        disabled && "pointer-events-none opacity-75"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ contain: 'layout', width: "100%" }}
      ref={(el) => {
        if (el) observeArtwork(el, artwork);
      }}
    >
      <ArtworkCardImage
        artwork={artwork}
        title={artwork.title}
        onClick={disabled ? undefined : handleView}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onExport={handleExport}
        onDelete={handleDelete}
      />
      <ArtworkCardInfo
        artwork={artwork}
        artistName={artistName}
        available={available}
      />
    </div>
  );
};

// Optimize memo comparison
const arePropsEqual = (
  prevProps: OptimizedArtworkCardProps,
  nextProps: OptimizedArtworkCardProps
) => {
  return (
    prevProps.artwork.id === nextProps.artwork.id &&
    prevProps.artwork.updated_at === nextProps.artwork.updated_at &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.index === nextProps.index
  );
};

export const OptimizedArtworkCard = memo(OptimizedArtworkCardComponent, arePropsEqual);