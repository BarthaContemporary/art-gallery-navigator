
import React, { useState } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { OptimizedArtworkImage } from "./OptimizedArtworkImage";
import { ArtworkCardActions } from "./ArtworkCardActions";
import { cn } from "@/lib/utils";
import type { ImageRecord } from "@/utils/image-url-resolver";

interface ArtworkCardImageProps {
  artwork: Artwork;
  title: string;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDuplicate: (e: React.MouseEvent) => void;
  onExport: (e: React.MouseEvent) => void;
  onDelete: () => void;
}

export function ArtworkCardImage({
  artwork,
  title,
  onClick,
  onEdit,
  onDuplicate,
  onExport,
  onDelete,
}: ArtworkCardImageProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Get the primary image or first image for faster loading
  const primaryImage = artwork.artwork_images?.find(img => img.is_primary) || 
                      artwork.artwork_images?.[0];

  // Create a simple image record for the optimized image component
  const imageRecord: ImageRecord = {
    id: primaryImage?.id || artwork.id,
    image_url: primaryImage?.image_url || artwork.image_url || "/placeholder.svg",
    thumbnail_url: primaryImage?.thumbnail_url,
    medium_url: primaryImage?.medium_url,
    processed: primaryImage?.processed || false,
    is_primary: primaryImage?.is_primary || false,
    display_order: primaryImage?.display_order || 0
  };

  return (
    <div 
      className="relative w-full bg-muted/20 overflow-hidden flex-shrink-0"
      style={{ height: "192px" }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <OptimizedArtworkImage
        imageRecord={imageRecord}
        title={title}
        className="w-full h-full object-cover transition-transform duration-300 cursor-pointer hover:scale-105"
        tier="thumbnail" // Use thumbnail for grid view for faster loading
      />
      
      {/* Overlay with actions */}
      <div className={cn(
        "absolute inset-0 transition-opacity duration-200",
        isHovered ? "opacity-100" : "opacity-0"
      )}>
        <div
          className="absolute top-2 right-2 z-20"
          onClick={e => e.stopPropagation()}
        >
          <ArtworkCardActions
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onExport={onExport}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
}
