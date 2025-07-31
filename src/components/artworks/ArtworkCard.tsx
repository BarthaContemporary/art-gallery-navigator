
import React, { memo, useState } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { useArtists } from "@/hooks/useArtists";
import { ArtworkOverviewDialogHandler } from "./dialogs/ArtworkOverviewDialogHandler";
import { ArtworkEditDialogHandler } from "./dialogs/ArtworkEditDialogHandler";
import { ArtworkDeleteDialogHandler } from "./dialogs/ArtworkDeleteDialogHandler";
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

  const {
    handleView,
    handleEdit,
    handleDelete,
    handleDuplicate,
    handleExport,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    isOverviewDialogOpen,
    setIsOverviewDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    isDeleting
  } = useArtworkActions(artwork);

  const onEdit = (e: React.MouseEvent) => {
    if (disabled) return;
    if (e) e.stopPropagation();
    handleEdit();
  };
  const onDuplicate = (e: React.MouseEvent) => {
    if (disabled) return;
    if (e) e.stopPropagation();
    handleDuplicate();
  };
  const onExport = (e: React.MouseEvent) => {
    if (disabled) return;
    if (e) e.stopPropagation();
    handleExport();
  };
  const onDelete = () => {
    if (disabled) return;
    setIsDeleteDialogOpen(true);
  };

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
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onExport={onExport}
          onDelete={onDelete}
        />
        <ArtworkCardInfo
          artwork={artwork}
          artistName={artistName}
          available={available}
        />
      </div>
      {/* DIALOGS: Actual components must be rendered so state works */}
      <ArtworkOverviewDialogHandler
        artwork={artwork}
        open={isOverviewDialogOpen}
        onOpenChange={setIsOverviewDialogOpen}
      />
      <ArtworkEditDialogHandler
        artwork={artwork}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
      <ArtworkDeleteDialogHandler
        artwork={artwork}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        isDeleting={isDeleting}
        confirmDelete={async () => { await handleDelete(); }}
      />
    </>
  );
}

export const ArtworkCard = memo(ArtworkCardComponent);
