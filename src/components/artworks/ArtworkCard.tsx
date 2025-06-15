
import React, { memo, useState } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { useArtists } from "@/hooks/useArtists";
import { OptimizedArtworkImage } from "./OptimizedArtworkImage";
import { ArtworkOverviewDialogHandler } from "./dialogs/ArtworkOverviewDialogHandler";
import { ArtworkEditDialogHandler } from "./dialogs/ArtworkEditDialogHandler";
import { ArtworkDeleteDialogHandler } from "./dialogs/ArtworkDeleteDialogHandler";
import { Check, X } from "lucide-react";
import { useArtworkActions } from "@/hooks/use-artwork-actions";
import { ArtworkCardActions } from "./ArtworkCardActions";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();

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

  // Year, Dimensions
  let year = artwork.year ? artwork.year : "";
  let dimensions = "";
  if (
    artwork.height != null ||
    artwork.width != null ||
    artwork.depth != null
  ) {
    const dList = [];
    if (artwork.height != null) dList.push(Number(artwork.height).toLocaleString(undefined, { maximumFractionDigits: 2 }));
    if (artwork.width != null) dList.push(Number(artwork.width).toLocaleString(undefined, { maximumFractionDigits: 2 }));
    if (artwork.depth != null) dList.push(Number(artwork.depth).toLocaleString(undefined, { maximumFractionDigits: 2 }));
    dimensions = dList.length > 0 ? `${dList.join(" x ")} cm` : "";
  } else if (artwork.dimensions) {
    dimensions = artwork.dimensions;
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

  // Allow each handler to be used as event handler
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

  // 2/3 height logic
  const IMAGE_HEIGHT_PX = 256;
  const INFO_HEIGHT_PX = Math.round((2 / 3) * IMAGE_HEIGHT_PX); // ≈170

  // Truncated title + year for card bar
  const truncatedTitleWithYear = getTruncatedTitleWithYear(
    artwork.title,
    artwork.year,
    26 // Tweak as needed for card width
  );

  return (
    <>
      <div 
        className="group relative flex flex-col border rounded-lg bg-card hover:shadow-md transition-all duration-200 overflow-hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ contain: 'layout', width: "100%" }}
      >
        <div
          className="relative w-full bg-muted/20 overflow-hidden flex-shrink-0"
          style={{ height: `${IMAGE_HEIGHT_PX}px` }}
        >
          {/* ACTION BUTTONS (absolute top right, shown on hover desktop or always mobile) */}
          <div
            className={`
              absolute top-2 right-2 z-20 
              transition-opacity duration-200
              ${isMobile ? "opacity-100" : (isHovered ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
            `}
            onClick={e => e.stopPropagation()}
          >
            <ArtworkCardActions
              onEdit={onEdit}
              onDuplicate={onDuplicate}
              onExport={onExport}
              onDelete={onDelete}
            />
          </div>
          {imageToDisplay ? (
            <OptimizedArtworkImage
              imageRecord={imageToDisplay}
              title={artwork.title}
              onClick={handleView}
              className="w-full h-full object-cover cursor-pointer"
            />
          ) : (
            <div 
              className="w-full h-full bg-muted/30 flex items-center justify-center cursor-pointer"
              onClick={handleView}
            >
              <div className="text-center text-muted-foreground">
                <div className="w-12 h-12 bg-muted/60 rounded mx-auto mb-2"></div>
                <p className="text-sm">No Image</p>
              </div>
            </div>
          )}
        </div>
        <div
          className="flex flex-col justify-between px-4 py-4 flex-shrink-0"
          style={{ height: `${INFO_HEIGHT_PX}px` }}
        >
          <div className="space-y-2">
            <p className="font-medium text-base text-muted-foreground truncate">{artistName}</p>
            <h3 className="font-semibold text-lg leading-tight truncate" title={artwork.title + (year ? `, ${year}` : "")}>
              {truncatedTitleWithYear}
            </h3>
            {dimensions && (
              <p className="text-sm text-muted-foreground">{dimensions}</p>
            )}
            <p className="text-xs text-muted-foreground">{artwork.medium_type}</p>
          </div>
          {/* Bottom row: left price (if available), right: status icon */}
          <div className="flex items-center mt-2">
            <div className="flex-1 min-w-0">
              {artwork.price ? (
                <span className="text-sm font-medium block truncate">
                  {artwork.currency} {Number(artwork.price).toLocaleString()}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground block">Price on request</span>
              )}
            </div>
            <div className="flex-shrink-0 pl-2">
              {available ? (
                <Check className="h-5 w-5 text-green-600" aria-label="Available" />
              ) : (
                <X className="h-5 w-5 text-destructive" aria-label="Unavailable" />
              )}
            </div>
          </div>
        </div>
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
