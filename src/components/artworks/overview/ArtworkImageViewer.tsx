
import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { useArtworkCarousel } from "@/hooks/use-artwork-carousel";
import { OptimizedArtworkImage } from "@/components/artworks/OptimizedArtworkImage";
import { cn } from "@/lib/utils";
import "./ArtworkImageViewer.css";

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
    canScrollPrev,
    canScrollNext,
  } = useArtworkCarousel(artworkId);

  if (loading) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-muted/20">
        <div className="text-center text-muted-foreground">
          <div className="w-12 h-12 bg-muted/60 rounded mx-auto mb-2 animate-pulse"></div>
          <p className="text-sm">Loading images...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-muted/20">
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
      <div className="w-full h-96 flex items-center justify-center bg-muted/20">
        <div className="text-center text-muted-foreground">
          <div className="w-12 h-12 bg-muted/60 rounded mx-auto mb-2"></div>
          <p className="text-sm">No images available</p>
        </div>
      </div>
    );
  }

  const showNavigation = images.length > 1;

  return (
    <div className="artwork-viewer">
      <div className="embla" ref={emblaRef}>
        <div className="embla__viewport">
          <div className="embla__container">
            {images.map((image, index) => (
              <div key={image.id} className="embla__slide">
                <div className="embla__slide__inner">
                  <OptimizedArtworkImage
                    imageRecord={image}
                    title={`${artworkTitle} - Image ${index + 1}`}
                    className="w-full h-full"
                    tier="medium"
                  />
                  
                  {/* Zoom button overlay */}
                  <div className="embla__zoom-overlay">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="opacity-80 hover:opacity-100"
                    >
                      <ZoomIn className="h-4 w-4 mr-1" />
                      Zoom
                    </Button>
                  </div>
                  
                  {/* Image info overlay */}
                  <div className="embla__image-info">
                    {index + 1} / {images.length}
                    {image.is_primary && " (Primary)"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation arrows */}
      {showNavigation && (
        <>
          <Button
            variant="secondary"
            size="icon"
            className={cn(
              "embla__nav-button embla__nav-button--prev",
              !canScrollPrev && "opacity-50 cursor-not-allowed"
            )}
            onClick={scrollPrev}
            disabled={!canScrollPrev}
            aria-label="Previous image"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className={cn(
              "embla__nav-button embla__nav-button--next",
              !canScrollNext && "opacity-50 cursor-not-allowed"
            )}
            onClick={scrollNext}
            disabled={!canScrollNext}
            aria-label="Next image"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </>
      )}

      {/* Dot indicators */}
      {showNavigation && (
        <div className="embla__dots">
          {images.map((_, index) => (
            <button
              key={index}
              className={cn(
                "embla__dot",
                index === currentIndex && "embla__dot--selected"
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
