import React, { useEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArtworkImageRenderer } from "../ArtworkImageRenderer";
import { ZoomControls } from "../carousel/ZoomControls";
import { CarouselContainer } from "../carousel/CarouselContainer";
import { useZoomControls } from "../carousel/useZoomControls";
import useEmblaCarousel from "embla-carousel-react";
import type { ImageRecord } from "@/utils/image-url-resolver";

interface ArtworkCarouselProps {
  images: ImageRecord[];
  artworkTitle: string;
  onClose?: () => void;
  onExport?: () => void;
  className?: string;
}

export function ArtworkCarousel({ 
  images, 
  artworkTitle, 
  onClose, 
  onExport,
  className 
}: ArtworkCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false,
    align: 'center',
    containScroll: 'trimSnaps'
  });
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  
  const {
    zoomLevel,
    isZoomed,
    canZoomIn,
    canZoomOut,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    resetZoom
  } = useZoomControls();

  const sortedImages = images
    .filter(img => img.image_url && !img.image_url.includes('processing'))
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

  // Update carousel state
  const updateCarouselState = useCallback(() => {
    if (!emblaApi) return;
    setCurrentIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  // Initialize carousel
  useEffect(() => {
    if (!emblaApi) return;
    
    updateCarouselState();
    emblaApi.on('select', updateCarouselState);
    emblaApi.on('reInit', updateCarouselState);

    return () => {
      emblaApi.off('select', updateCarouselState);
      emblaApi.off('reInit', updateCarouselState);
    };
  }, [emblaApi, updateCarouselState]);

  // Reset zoom when changing images
  useEffect(() => {
    resetZoom();
  }, [currentIndex, resetZoom]);

  // Navigation handlers
  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          scrollPrev();
          break;
        case 'ArrowRight':
          scrollNext();
          break;
        case 'Escape':
          onClose?.();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        case '0':
          handleZoomReset();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scrollPrev, scrollNext, onClose, handleZoomIn, handleZoomOut, handleZoomReset]);

  if (sortedImages.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-64", className)}>
        <p className="text-muted-foreground">No images available</p>
      </div>
    );
  }

  return (
    <div className={cn("relative w-full h-full bg-black/5 rounded-lg overflow-hidden", className)}>
      {/* Header with controls */}
      <div className="absolute top-4 left-4 right-4 z-30 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-white bg-black/40 px-3 py-1 rounded backdrop-blur-sm">
            {artworkTitle}
          </h3>
          <span className="text-xs text-white bg-black/40 px-2 py-1 rounded backdrop-blur-sm">
            {currentIndex + 1} / {sortedImages.length}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {onExport && (
            <Button
              variant="secondary"
              size="sm"
              className="bg-black/40 hover:bg-black/60 text-white border-none backdrop-blur-sm"
              onClick={onExport}
            >
              <Download className="w-4 h-4" />
            </Button>
          )}
          {onClose && (
            <Button
              variant="secondary"
              size="sm"
              className="bg-black/40 hover:bg-black/60 text-white border-none backdrop-blur-sm"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

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

      {/* Image Container */}
      <div className="overflow-hidden h-full" ref={emblaRef}>
        <div className="flex h-full">
          {sortedImages.map((image, index) => (
            <div key={image.id} className="flex-none w-full h-full relative">
              <ArtworkImageRenderer
                imageRecord={image}
                title={artworkTitle}
                className="w-full h-full"
                tier="full"
                priority={index === currentIndex}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation buttons */}
      {sortedImages.length > 1 && (
        <>
          <Button
            variant="secondary"
            size="sm"
            className={cn(
              "absolute left-4 top-1/2 -translate-y-1/2 z-30",
              "w-8 h-8 p-0 bg-black/40 hover:bg-black/60 text-white border-none backdrop-blur-sm",
              "transition-opacity duration-200",
              canScrollPrev ? "opacity-100" : "opacity-30 pointer-events-none"
            )}
            onClick={scrollPrev}
            disabled={!canScrollPrev}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <Button
            variant="secondary"
            size="sm"
            className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2 z-30",
              "w-8 h-8 p-0 bg-black/40 hover:bg-black/60 text-white border-none backdrop-blur-sm",
              "transition-opacity duration-200",
              canScrollNext ? "opacity-100" : "opacity-30 pointer-events-none"
            )}
            onClick={scrollNext}
            disabled={!canScrollNext}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </>
      )}

      {/* Thumbnail navigation */}
      {sortedImages.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
          <div className="flex gap-2 bg-black/40 p-2 rounded backdrop-blur-sm">
            {sortedImages.map((_, index) => (
              <button
                key={index}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  index === currentIndex ? "bg-white" : "bg-white/40 hover:bg-white/60"
                )}
                onClick={() => emblaApi?.scrollTo(index)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}