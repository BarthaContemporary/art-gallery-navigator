
import React from "react";
import { LocalArtworkImage } from "./LocalArtworkImage";
import { ArtworkCardActions } from "./ArtworkCardActions";
import { Artwork } from "@/hooks/use-artworks";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocalArtworkImages } from "@/hooks/use-local-artwork-images";
import { CloudinaryImageService } from "@/services/cloudinary-image-service";
import { logger } from "@/lib/logger";

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
  const { primaryImage, legacyImageUrl, hasProcessingImages, loading } = useLocalArtworkImages(artwork.id);
  
  // Debug logging for troubleshooting
  React.useEffect(() => {
    logger.log(`[ArtworkCardImage] Artwork: ${title}`, {
      artworkId: artwork.id,
      primaryImage: primaryImage ? {
        id: primaryImage.id,
        processing_status: primaryImage.processing_status,
        thumbnail_storage_path: primaryImage.thumbnail_storage_path,
        medium_storage_path: primaryImage.medium_storage_path,
        original_storage_path: primaryImage.original_storage_path,
        image_url: primaryImage.image_url
      } : null,
      legacyImageUrl,
      hasProcessingImages,
      loading,
      artworkImageUrl: artwork.image_url
    });
  }, [artwork.id, title, primaryImage, legacyImageUrl, hasProcessingImages, loading, artwork.image_url]);
  
  // Check if we should show processing indicator based on CloudinaryImageService
  const processingStatus = primaryImage ? 
    CloudinaryImageService.analyzeProcessingStatus(primaryImage) : 
    { isProcessed: false, needsProcessing: false, processingInProgress: false };
  
  const showProcessingIndicator = hasProcessingImages || 
    processingStatus.processingInProgress || 
    processingStatus.needsProcessing;
  
  // Determine if we have any image to show
  const hasAnyImage = primaryImage || legacyImageUrl || artwork.image_url;
  
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
      {showProcessingIndicator && (
        <div className="absolute top-2 left-2 z-10 bg-blue-500/90 text-white px-2 py-1 rounded text-xs">
          {processingStatus.processingInProgress ? 'Processing' : 'Needs Processing'}
        </div>
      )}
      
      {hasAnyImage ? (
        <LocalArtworkImage
          imageRecord={primaryImage}
          title={title}
          onClick={onClick}
          className="w-full h-full cursor-pointer"
          size="thumbnail"
          showProcessingStatus={false}
        />
      ) : loading ? (
        <div className="w-full h-full bg-muted/30 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <div className="w-6 h-6 bg-muted/60 rounded mx-auto mb-2 animate-pulse"></div>
            <p className="text-sm">Loading...</p>
          </div>
        </div>
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
