
import React, { memo, useState, useCallback } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { useDialogManager } from "@/hooks/use-dialog-manager";
import { useArtworkActions } from "@/hooks/use-artwork-actions";
import { ArtworkCardImage } from "./ArtworkCardImage";
import { ArtworkCardInfo } from "./ArtworkCardInfo";

interface ArtworkCardProps {
  artwork: Artwork;
  disabled?: boolean;
}

function ArtworkCardComponent({ artwork, disabled = false }: ArtworkCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Use artist name from the artwork data (already included in query)
  const artistName = artwork.artist_name || "Unknown Artist";

  // Status: Available if "available" (case-insensitive), else not. Use icon.
  const available = (artwork.status || "available").toLowerCase() === "available";

  const { showArtworkOverview, showArtworkEdit, showArtworkDelete } = useDialogManager();
  const { handleDuplicate: duplicateArtwork } = useArtworkActions(artwork);

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

  return (
    <>
      <div 
        className="group relative flex flex-col border rounded-lg bg-card hover:shadow-md transition-all duration-200 overflow-hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ contain: 'layout', width: "100%" }}
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
    </>
  );
}

export const ArtworkCard = memo(ArtworkCardComponent);
