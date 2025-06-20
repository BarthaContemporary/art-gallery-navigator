
import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useArtworkCarousel } from "@/hooks/use-artwork-carousel";
import { OptimizedArtworkImage } from "@/components/artworks/OptimizedArtworkImage";
import { cn } from "@/lib/utils";

interface ArtworkImageViewerProps {
  artworkId: string;
  artworkTitle: string;
}

export function ArtworkImageViewer({ artworkId, artworkTitle }: ArtworkImageViewerProps) {
  const {
    images,
    currentIndex,
    loading,
    error,
    emblaRef,
    handleDotClick,
    scrollPrev,
    scrollNext,
  } = useArtworkCarousel(artworkId);

  if (loading) {
    return (
      <div className="w-full bg-muted/20 overflow-hidden flex-shrink-0 h-96 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="w-12 h-12 bg-muted/60 rounded mx-auto mb-2 animate-pulse"></div>
          <p className="text-sm">Loading images...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full bg-muted/20 overflow-hidden flex-shrink-0 h-96 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="w-12 h-12 bg-red-100 rounded mx-auto mb-2 flex items-center justify-center">
            <span className="text-red-500">⚠️</span>
          </div>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!images || images.length === 0) {
    return (
      <div className="w-full bg-muted/20 overflow-hidden flex-shrink-0 h-96 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="w-12 h-12 bg-muted/60 rounded mx-auto mb-2"></div>
          <p className="text-sm">No images available</p>
        </div>
      </div>
    );
  }

  const showNavigation = images.length > 1;

  return (
    <div className="relative w-full h-96 bg-muted/10">
      {/* Main carousel container */}
      <div className="embla h-full" ref={emblaRef}>
        <div className="embla__container h-full flex">
          {images.map((image, index) => (
            <div
              key={image.id}
              className="embla__slide flex-shrink-0 flex-grow-0 basis-full relative h-full"
            >
              <OptimizedArtworkImage
                imageRecord={image}
                title={`${artworkTitle} - Image ${index + 1}`}
                className="w-full h-full"
                tier="medium"
              />
              
              {/* Image info overlay */}
              <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                {index + 1} / {images.length}
                {image.is_primary && " (Primary)"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation arrows */}
      {showNavigation && (
        <>
          <Button
            variant="outline"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-md"
            onClick={scrollPrev}
            aria-label="Previous image"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-md"
            onClick={scrollNext}
            aria-label="Next image"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </>
      )}

      {/* Dot indicators */}
      {showNavigation && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {images.map((_, index) => (
            <button
              key={index}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                index === currentIndex
                  ? "bg-white shadow-lg"
                  : "bg-white/50 hover:bg-white/75"
              )}
              onClick={() => handleDotClick(index)}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
