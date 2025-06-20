
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
    isCarouselReady,
    handleDotClick,
    scrollPrev,
    scrollNext,
    canScrollPrev,
    canScrollNext,
    handleImageLoadComplete,
  } = useArtworkCarousel(artworkId);

  console.log(`[ArtworkImageViewer] Rendering - ${images?.length || 0} images, ready: ${isCarouselReady}`);

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

  const showNavigation = images.length > 1;

  const handlePrevClick = () => {
    console.log(`[ArtworkImageViewer] Previous clicked - canScrollPrev: ${canScrollPrev}`);
    scrollPrev();
  };

  const handleNextClick = () => {
    console.log(`[ArtworkImageViewer] Next clicked - canScrollNext: ${canScrollNext}`);
    scrollNext();
  };

  const handleDotNavClick = (index: number) => {
    console.log(`[ArtworkImageViewer] Dot ${index + 1} clicked`);
    handleDotClick(index);
  };

  return (
    <div className="artwork-viewer">
      <div className="embla" ref={emblaRef}>
        <div className="embla__viewport">
          <div className="embla__container">
            {images.map((image, index) => (
              <div key={image.id} className="embla__slide">
                <div className="embla__slide__content">
                  <OptimizedArtworkImage
                    imageRecord={image}
                    title={`${artworkTitle} - Image ${index + 1}`}
                    className="slide-image"
                    tier="medium"
                    onLoadingStart={() => console.log(`[Carousel] Loading image ${index + 1}`)}
                    onLoadingComplete={handleImageLoadComplete}
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

      {/* Navigation arrows - Always render but conditionally show */}
      {showNavigation && (
        <>
          <Button
            variant="secondary"
            size="icon"
            className={cn(
              "carousel-nav carousel-nav--prev",
              !canScrollPrev && "carousel-nav--disabled"
            )}
            onClick={handlePrevClick}
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
            onClick={handleNextClick}
            disabled={!canScrollNext}
            aria-label="Next image"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </>
      )}

      {/* Dot indicators - Always render but conditionally show */}
      {showNavigation && (
        <div className="carousel-dots">
          {images.map((_, index) => (
            <button
              key={index}
              className={cn(
                "carousel-dot",
                index === currentIndex && "carousel-dot--active"
              )}
              onClick={() => handleDotNavClick(index)}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Debug info (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="carousel-debug">
          Ready: {isCarouselReady ? '✅' : '❌'} | 
          Index: {currentIndex} | 
          Prev: {canScrollPrev ? '✅' : '❌'} | 
          Next: {canScrollNext ? '✅' : '❌'} |
          Images: {images.length}
        </div>
      )}
    </div>
  );
}
