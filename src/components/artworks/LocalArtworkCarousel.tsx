
import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { useLocalArtworkImages } from "@/hooks/use-local-artwork-images";
import { LocalArtworkImage } from "./LocalArtworkImage";
import { cn } from "@/lib/utils";
import useEmblaCarousel from "embla-carousel-react";

interface LocalArtworkCarouselProps {
  artworkId: string;
  artworkTitle: string;
}

export function LocalArtworkCarousel({ artworkId, artworkTitle }: LocalArtworkCarouselProps) {
  const { images, loading, error, hasProcessingImages } = useLocalArtworkImages(artworkId);
  
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false,
    align: "center",
  });

  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [zoomLevel, setZoomLevel] = React.useState(1);
  const [isZoomed, setIsZoomed] = React.useState(false);

  // Zoom levels: 1x, 1.5x, 2x, 3x, 4x
  const zoomLevels = [1, 1.5, 2, 3, 4];

  // Handle carousel selection
  React.useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      setCurrentIndex(emblaApi.selectedScrollSnap());
      // Reset zoom when changing slides
      setZoomLevel(1);
      setIsZoomed(false);
    };

    emblaApi.on("select", onSelect);
    onSelect(); // Set initial index

    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

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

  const handleZoomIn = React.useCallback(() => {
    const currentZoomIndex = zoomLevels.indexOf(zoomLevel);
    if (currentZoomIndex < zoomLevels.length - 1) {
      const newZoom = zoomLevels[currentZoomIndex + 1];
      setZoomLevel(newZoom);
      setIsZoomed(newZoom > 1);
    }
  }, [zoomLevel, zoomLevels]);

  const handleZoomOut = React.useCallback(() => {
    const currentZoomIndex = zoomLevels.indexOf(zoomLevel);
    if (currentZoomIndex > 0) {
      const newZoom = zoomLevels[currentZoomIndex - 1];
      setZoomLevel(newZoom);
      setIsZoomed(newZoom > 1);
    }
  }, [zoomLevel, zoomLevels]);

  const handleZoomReset = React.useCallback(() => {
    setZoomLevel(1);
    setIsZoomed(false);
  }, []);

  const canScrollPrev = emblaApi?.canScrollPrev() ?? false;
  const canScrollNext = emblaApi?.canScrollNext() ?? false;
  const hasMultipleImages = images.length > 1;
  const canZoomIn = zoomLevel < Math.max(...zoomLevels);
  const canZoomOut = zoomLevel > Math.min(...zoomLevels);

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
      {/* Processing Status - Top Left */}
      {hasProcessingImages && (
        <div className="absolute top-4 left-4 z-20 bg-blue-500/80 text-white px-3 py-1 rounded-md text-sm backdrop-blur-sm">
          Images processing...
        </div>
      )}

      {/* Zoom Controls - Top Left Corner (Semi-transparent) */}
      <div className="absolute top-4 left-4 z-30 flex flex-col gap-1 opacity-60 hover:opacity-100 transition-opacity">
        <Button
          variant="secondary"
          size="sm"
          className="w-8 h-8 p-0 bg-black/40 hover:bg-black/60 text-white border-none backdrop-blur-sm"
          onClick={handleZoomIn}
          disabled={!canZoomIn}
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        
        <Button
          variant="secondary"
          size="sm"
          className="w-8 h-8 p-0 bg-black/40 hover:bg-black/60 text-white border-none backdrop-blur-sm"
          onClick={handleZoomOut}
          disabled={!canZoomOut}
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        
        {isZoomed && (
          <Button
            variant="secondary"
            size="sm"
            className="w-8 h-8 p-0 bg-black/40 hover:bg-black/60 text-white border-none backdrop-blur-sm"
            onClick={handleZoomReset}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
        
        {/* Zoom Level Indicator */}
        {isZoomed && (
          <div className="bg-black/40 text-white px-2 py-1 rounded text-xs backdrop-blur-sm text-center">
            {zoomLevel}x
          </div>
        )}
      </div>

      {/* Embla Carousel */}
      <div className="h-full" ref={emblaRef}>
        <div className="flex h-full">
          {images.map((image, index) => (
            <div key={image.id} className="flex-none w-full h-full relative">
              <div 
                className={cn(
                  "w-full h-full transition-transform duration-300 ease-in-out",
                  isZoomed ? "cursor-grab active:cursor-grabbing overflow-auto" : "overflow-hidden"
                )}
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center center'
                }}
              >
                <LocalArtworkImage
                  imageRecord={image}
                  title={`${artworkTitle} - Image ${index + 1}`}
                  className="w-full h-full object-contain"
                  size="large"
                  showProcessingStatus={true}
                />
              </div>
              
              {/* Image Info Overlay - Top Right */}
              <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded-md text-sm backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                <span>{index + 1} / {images.length}</span>
                {image.is_primary && (
                  <span className="ml-2 bg-primary px-2 py-0.5 rounded text-xs">Primary</span>
                )}
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
              "absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 hover:bg-black/60 text-white border-none backdrop-blur-sm",
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
              "absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 hover:bg-black/60 text-white border-none backdrop-blur-sm",
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
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 px-3 py-2 rounded-full backdrop-blur-sm">
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
