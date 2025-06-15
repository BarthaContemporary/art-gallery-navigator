
import React, { memo, useState } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { useArtists } from "@/hooks/useArtists";
import { ArtworkOverviewDialogHandler } from "./dialogs/ArtworkOverviewDialogHandler";
import { ArtworkEditDialogHandler } from "./dialogs/ArtworkEditDialogHandler";
import { ArtworkDeleteDialogHandler } from "./dialogs/ArtworkDeleteDialogHandler";
import { useArtworkActions } from "@/hooks/use-artwork-actions";
import { ArtworkCardImage } from "./ArtworkCardImage";
import { ArtworkCardInfo } from "./ArtworkCardInfo";

// Helper to truncate title and ensure one-line "title, year"
function getTruncatedTitleWithYear(title: string, year: string | number | null, maxLength = 26) {
  if (!title) return year ? `Untitled, ${year}` : "Untitled";
  const yearStr = year ? `, ${year}` : "";
  const remaining = maxLength - yearStr.length;
  let displayTitle = title.length > remaining ? title.slice(0, Math.max(0, remaining - 3)) + "..." : title;
  return `${displayTitle}${yearStr}`;
}

interface ArtworkCardProps {
  artwork: Artwork;
}

function ArtworkCardComponent({ artwork }: ArtworkCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const images = artwork.artwork_images || [];
  const primaryImage = images.find(img => img.is_primary) || images[0];
  const imageToDisplay = primaryImage || (artwork.image_url ? {
    id: `fallback-${artwork.id}`,
    artwork_id: artwork.id,
    image_url: artwork.image_url,
    is_primary: true,
    display_order: 0,
    medium_url: artwork.image_url,
    thumbnail_url: artwork.image_url
  } : undefined);

  // Fetch artists map for fast lookup
  const { data: artists } = useArtists();
  let artistName = "Unknown Artist";
  if (artwork.artist_id && artists) {
    const artist = artists.find(a => a.id === artwork.artist_id);
    if (artist) artistName = artist.full_name;
  }

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
    if (e) e.stopPropagation();
    handleEdit();
  };
  const onDuplicate = (e: React.MouseEvent) => {
    if (e) e.stopPropagation();
    handleDuplicate();
  };
  const onExport = (e: React.MouseEvent) => {
    if (e) e.stopPropagation();
    handleExport();
  };
  const onDelete = () => setIsDeleteDialogOpen(true);

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
          primaryImage={imageToDisplay}
          onClick={handleView}
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
