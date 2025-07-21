
import React from "react";
import { useLocalArtworkImages } from "@/hooks/use-local-artwork-images";
import { ZoomControls } from "./carousel/ZoomControls";
import { NavigationArrows } from "./carousel/NavigationArrows";
import { CompactCarouselIndicator } from "./carousel/CompactCarouselIndicator";
import { VirtualizedCarousel } from "./carousel/VirtualizedCarousel";
import { ZoomableImage } from "./carousel/ZoomableImage";
import { useZoomControls } from "./carousel/useZoomControls";
import type { ImageRecord } from "@/utils/image-url-resolver";

interface LocalArtworkCarouselProps {
  artworkId: string;
  artworkTitle: string;
}

export function LocalArtworkCarousel({ artworkId, artworkTitle }: LocalArtworkCarouselProps) {
  const { images, loading, error, hasProcessingImages } = useLocalArtworkImages(artworkId);
  
  const [currentIndex, setCurrentIndex] = React.useState(0);
  
  const {
    zoomLevel,
    isZoomed,
    panPosition,
    isDragging,
    canZoomIn,
    canZoomOut,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    resetZoom,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useZoomControls();

  // Sort images by display_order to ensure consistent ordering
  const sortedImages = React.useMemo(() => {
    return [...images].sort((a, b) => {
      // Primary image first, then by display_order
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return (a.display_order || 0) - (b.display_order || 0);
    });
  }, [images]);

  // Reset zoom when changing slides
  React.useEffect(() => {
    resetZoom();
  }, [currentIndex, resetZoom]);

  // Navigation functions
  const scrollPrev = React.useCallback(() => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? sortedImages.length - 1 : prevIndex - 1
    );
  }, [sortedImages.length]);

  const scrollNext = React.useCallback(() => {
    setCurrentIndex((prevIndex) => 
      prevIndex === sortedImages.length - 1 ? 0 : prevIndex + 1
    );
  }, [sortedImages.length]);

  const scrollTo = React.useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const canScrollPrev = sortedImages.length > 1;
  const canScrollNext = sortedImages.length > 1;
  const hasMultipleImages = sortedImages.length > 1;

  if (loading) {
    return (
      <div className="w-full h-[500px] bg-muted/10 rounded-lg flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="w-12 h-12 bg-muted animate-pulse rounded mb-3 mx-auto"></div>
          <p className="text-sm">Loading images...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[500px] bg-muted/10 rounded-lg flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="text-2xl mb-2">⚠️</div>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!sortedImages || sortedImages.length === 0) {
    return (
      <div className="w-full h-[500px] bg-muted/10 rounded-lg flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="text-2xl mb-2">🖼️</div>
          <p className="text-sm">No images available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[500px] bg-muted/10 rounded-lg overflow-hidden group">
      {/* Processing Status - Top Left */}
      {hasProcessingImages && (
        <div className="absolute top-4 left-4 z-20 bg-blue-500/80 text-white px-3 py-1 rounded-md text-sm backdrop-blur-sm">
          Images processing...
        </div>
      )}

      {/* Zoom Controls */}
      <ZoomControls
        zoomLevel={zoomLevel}
        isZoomed={isZoomed}
        canZoomIn={canZoomIn}
        canZoomOut={canZoomOut}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
      />

      {/* Zoomable Image Display */}
      <div className="w-full h-full relative overflow-hidden">
        {sortedImages[currentIndex] && (
          <ZoomableImage
            imageRecord={{
              id: sortedImages[currentIndex].id,
              image_url: sortedImages[currentIndex].medium_storage_path 
                ? `https://cvhdspyugfcvkrufqzrq.supabase.co/storage/v1/object/public/artwork-images-processed/${sortedImages[currentIndex].medium_storage_path}`
                : '/placeholder.svg',
              medium_url: sortedImages[currentIndex].medium_storage_path 
                ? `https://cvhdspyugfcvkrufqzrq.supabase.co/storage/v1/object/public/artwork-images-processed/${sortedImages[currentIndex].medium_storage_path}`
                : undefined,
              thumbnail_url: sortedImages[currentIndex].thumbnail_storage_path
                ? `https://cvhdspyugfcvkrufqzrq.supabase.co/storage/v1/object/public/artwork-images-processed/${sortedImages[currentIndex].thumbnail_storage_path}`
                : undefined,
            } as ImageRecord}
            title={artworkTitle}
            className="w-full h-full"
            tier="medium"
            priority={true}
            zoomLevel={zoomLevel}
            panPosition={panPosition}
            isDragging={isDragging}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
        )}
      </div>

      {/* Navigation Arrows */}
      <NavigationArrows
        hasMultipleImages={hasMultipleImages}
        canScrollPrev={canScrollPrev}
        canScrollNext={canScrollNext}
        onScrollPrev={scrollPrev}
        onScrollNext={scrollNext}
      />

      {/* Compact Carousel Indicator */}
      <CompactCarouselIndicator
        hasMultipleImages={hasMultipleImages}
        currentIndex={currentIndex}
        totalImages={sortedImages.length}
        onScrollTo={scrollTo}
      />
    </div>
  );
}
