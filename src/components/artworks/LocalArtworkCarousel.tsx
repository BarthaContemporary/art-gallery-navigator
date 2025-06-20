
import React from "react";
import { useLocalArtworkImages } from "@/hooks/use-local-artwork-images";
import useEmblaCarousel from "embla-carousel-react";
import { ZoomControls } from "./carousel/ZoomControls";
import { NavigationArrows } from "./carousel/NavigationArrows";
import { ElegantDialIndicator } from "./carousel/ElegantDialIndicator";
import { CarouselContainer } from "./carousel/CarouselContainer";
import { useZoomControls } from "./carousel/useZoomControls";

interface LocalArtworkCarouselProps {
  artworkId: string;
  artworkTitle: string;
}

export function LocalArtworkCarousel({ artworkId, artworkTitle }: LocalArtworkCarouselProps) {
  const { images, loading, error, hasProcessingImages } = useLocalArtworkImages(artworkId);
  
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: true, // Enable looping
    align: "center",
  });

  const [currentIndex, setCurrentIndex] = React.useState(0);
  
  const {
    zoomLevel,
    isZoomed,
    canZoomIn,
    canZoomOut,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    resetZoom,
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

  // Handle carousel selection
  React.useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      setCurrentIndex(emblaApi.selectedScrollSnap());
      // Reset zoom when changing slides
      resetZoom();
    };

    emblaApi.on("select", onSelect);
    onSelect(); // Set initial index

    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, resetZoom]);

  const scrollTo = React.useCallback((index: number) => {
    if (!emblaApi) return;
    emblaApi.scrollTo(index);
  }, [emblaApi]);

  const scrollPrev = React.useCallback(() => {
    if (!emblaApi) return;
    emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = React.useCallback(() => {
    if (!emblaApi) return;
    emblaApi.scrollNext();
  }, [emblaApi]);

  const canScrollPrev = emblaApi?.canScrollPrev() ?? false;
  const canScrollNext = emblaApi?.canScrollNext() ?? false;
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

      {/* Carousel Container */}
      <CarouselContainer
        sortedImages={sortedImages}
        artworkTitle={artworkTitle}
        currentIndex={currentIndex}
        zoomLevel={zoomLevel}
        isZoomed={isZoomed}
        emblaRef={emblaRef}
      />

      {/* Navigation Arrows */}
      <NavigationArrows
        hasMultipleImages={hasMultipleImages}
        canScrollPrev={canScrollPrev}
        canScrollNext={canScrollNext}
        onScrollPrev={scrollPrev}
        onScrollNext={scrollNext}
      />

      {/* Elegant Dial Indicator */}
      <ElegantDialIndicator
        hasMultipleImages={hasMultipleImages}
        currentIndex={currentIndex}
        totalImages={sortedImages.length}
        onScrollTo={scrollTo}
      />
    </div>
  );
}
