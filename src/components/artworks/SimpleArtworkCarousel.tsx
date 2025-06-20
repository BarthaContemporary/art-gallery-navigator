
import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { useSimpleArtworkCarousel } from "@/hooks/use-simple-artwork-carousel";
import { SimpleArtworkImage } from "./SimpleArtworkImage";
import { cn } from "@/lib/utils";

interface SimpleArtworkCarouselProps {
  artworkId: string;
  artworkTitle: string;
}

export function SimpleArtworkCarousel({ artworkId, artworkTitle }: SimpleArtworkCarouselProps) {
  const {
    images,
    currentIndex,
    loading,
    error,
    emblaRef,
    hasMultipleImages,
    scrollTo,
    scrollPrev,
    scrollNext,
    canScrollPrev,
    canScrollNext,
  } = useSimpleArtworkCarousel(artworkId);

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

  if (!images || images.length === 0) {
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
      {/* Embla Carousel */}
      <div className="h-full" ref={emblaRef}>
        <div className="flex h-full">
          {images.map((image, index) => (
            <div key={image.id} className="flex-none w-full h-full relative">
              <SimpleArtworkImage
                imageRecord={image}
                title={`${artworkTitle} - Image ${index + 1}`}
                className="w-full h-full"
                size="full"
              />
              
              {/* Image Info Overlay */}
              <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded-md text-sm backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                <span>{index + 1} / {images.length}</span>
                {image.is_primary && (
                  <span className="ml-2 bg-primary px-2 py-0.5 rounded text-xs">Primary</span>
                )}
              </div>
              
              {/* Zoom Button */}
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('Zoom functionality - coming in Phase 2');
                  }}
                >
                  <ZoomIn className="w-4 h-4 mr-1" />
                  Zoom
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Arrows */}
      {hasMultipleImages && (
        <>
          <Button
            variant="secondary"
            size="icon"
            className={cn(
              "absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity",
              !canScrollPrev && "opacity-30 cursor-not-allowed"
            )}
            onClick={scrollPrev}
            disabled={!canScrollPrev}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          
          <Button
            variant="secondary"
            size="icon"
            className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity",
              !canScrollNext && "opacity-30 cursor-not-allowed"
            )}
            onClick={scrollNext}
            disabled={!canScrollNext}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </>
      )}

      {/* Dot Indicators */}
      {hasMultipleImages && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {images.map((_, index) => (
            <button
              key={index}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                index === currentIndex 
                  ? "bg-white shadow-lg" 
                  : "bg-white/50 hover:bg-white/70"
              )}
              onClick={() => scrollTo(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
