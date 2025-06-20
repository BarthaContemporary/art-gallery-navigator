
import React from "react";
import { LocalArtworkImage } from "./LocalArtworkImage";
import { ArtworkCardActions } from "./ArtworkCardActions";
import { Artwork } from "@/hooks/use-artworks";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocalArtworkImages } from "@/hooks/use-local-artwork-images";

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
  const isMobile = useIsMobile();
  const { primaryImage, hasProcessingImages } = useLocalArtworkImages(artwork.id);
  
  return (
    <div
      className="relative w-full bg-muted/20 overflow-hidden flex-shrink-0"
      style={{ height: "192px" }}
    >
      <div
        className={`
          absolute top-2 right-2 z-20 
          transition-opacity duration-200
          ${isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
        `}
        onClick={e => e.stopPropagation()}
        data-testid="artwork-card-actions"
      >
        <ArtworkCardActions
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onExport={onExport}
          onDelete={onDelete}
        />
      </div>

      {/* Processing indicator */}
      {hasProcessingImages && (
        <div className="absolute top-2 left-2 z-10 bg-blue-500/90 text-white px-2 py-1 rounded text-xs">
          Processing
        </div>
      )}
      
      {primaryImage ? (
        <LocalArtworkImage
          imageRecord={primaryImage}
          title={title}
          onClick={onClick}
          className="w-full h-full cursor-pointer"
          size="thumbnail"
          showProcessingStatus={false}
        />
      ) : (
        <div
          className="w-full h-full bg-muted/30 flex items-center justify-center cursor-pointer"
          onClick={onClick}
        >
          <div className="text-center text-muted-foreground">
            <div className="w-12 h-12 bg-muted/60 rounded mx-auto mb-2"></div>
            <p className="text-sm">No Image</p>
          </div>
        </div>
      )}
    </div>
  );
}
