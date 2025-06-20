
import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { useCloudinaryCarousel } from "@/hooks/use-cloudinary-carousel";
import { CloudinaryArtworkImage } from "@/components/artworks/CloudinaryArtworkImage";
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
    hasMultipleImages,
    scrollTo,
    scrollPrev,
    scrollNext,
    canScrollPrev,
    canScrollNext,
  } = useCloudinaryCarousel(artworkId);

  if (loading) {
    return (
      <div className="artwork-viewer-loading">
        <div className="loading-content">
          <div className="loading-placeholder animate-pulse"></div>
          <p className="loading-text">Loading images...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="artwork-viewer-error">
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <p className="error-text">{error}</p>
        </div>
      </div>
    );
  }

  if (!images || images.length === 0) {
    return (
      <div className="artwork-viewer-empty">
        <div className="empty-content">
          <div className="empty-icon">🖼️</div>
          <p className="empty-text">No images available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="artwork-viewer">
      <div className="embla" ref={emblaRef}>
        <div className="embla__viewport">
          <div className="embla__container">
            {images.map((image, index) => (
              <div key={image.id} className="embla__slide">
                <div className="embla__slide__content">
                  <CloudinaryArtworkImage
                    imageRecord={image}
                    title={`${artworkTitle} - Image ${index + 1}`}
                    className="slide-image"
                    tier="medium"
                  />
                  
                  {/* Zoom button overlay */}
                  <div className="slide-overlay slide-overlay--zoom">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="zoom-button"
                    >
                      <ZoomIn className="h-4 w-4 mr-1" />
                      Zoom
                    </Button>
                  </div>
                  
                  {/* Image info overlay */}
                  <div className="slide-overlay slide-overlay--info">
                    <span className="image-counter">
                      {index + 1} / {images.length}
                    </span>
                    {image.is_primary && (
                      <span className="primary-badge">Primary</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation arrows */}
      {hasMultipleImages && (
        <>
          <Button
            variant="secondary"
            size="icon"
            className={cn(
              "carousel-nav carousel-nav--prev",
              !canScrollPrev && "carousel-nav--disabled"
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
              "carousel-nav carousel-nav--next",
              !canScrollNext && "carousel-nav--disabled"
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
      {hasMultipleImages && (
        <div className="carousel-dots">
          {images.map((_, index) => (
            <button
              key={index}
              className={cn(
                "carousel-dot",
                index === currentIndex && "carousel-dot--active"
              )}
              onClick={() => scrollTo(index)}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
