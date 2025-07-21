
import React, { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { OptimizedCarouselImage } from "./OptimizedCarouselImage";
import { useCarouselPreloader } from "@/hooks/use-carousel-preloader";
import type { LocalImageRecord } from "@/services/local-image-service";

interface VirtualizedCarouselProps {
  images: LocalImageRecord[];
  artworkTitle: string;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  className?: string;
}

export function VirtualizedCarousel({
  images,
  artworkTitle,
  currentIndex,
  onIndexChange,
  className
}: VirtualizedCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false,
    align: "center",
    skipSnaps: false,
    dragFree: false,
    containScroll: "trimSnaps"
  });

  const [visibleSlides, setVisibleSlides] = useState<Set<number>>(new Set());
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [errorImages, setErrorImages] = useState<Set<number>>(new Set());
  
  // Use preloader with connection awareness
  const { preloadedCount, isPreloading } = useCarouselPreloader({
    images,
    currentIndex,
    preloadRadius: 3,
    enabled: true
  });

  // Update visible slides based on viewport
  const updateVisibleSlides = useCallback(() => {
    if (!emblaApi) return;

    const slidesInView = emblaApi.slidesInView();
    const newVisibleSlides = new Set(slidesInView);
    
    // Always include current slide and immediate neighbors
    newVisibleSlides.add(currentIndex);
    if (currentIndex > 0) newVisibleSlides.add(currentIndex - 1);
    if (currentIndex < images.length - 1) newVisibleSlides.add(currentIndex + 1);
    
    setVisibleSlides(newVisibleSlides);
  }, [emblaApi, currentIndex, images.length]);

  // Handle carousel events
  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      const newIndex = emblaApi.selectedScrollSnap();
      onIndexChange(newIndex);
      updateVisibleSlides();
    };

    const onScroll = () => {
      updateVisibleSlides();
    };

    emblaApi.on("select", onSelect);
    emblaApi.on("scroll", onScroll);
    emblaApi.on("reInit", updateVisibleSlides);

    // Initial update
    updateVisibleSlides();

    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("scroll", onScroll);
      emblaApi.off("reInit", updateVisibleSlides);
    };
  }, [emblaApi, onIndexChange, updateVisibleSlides]);

  // Sync with external index changes
  useEffect(() => {
    if (emblaApi && emblaApi.selectedScrollSnap() !== currentIndex) {
      emblaApi.scrollTo(currentIndex);
    }
  }, [emblaApi, currentIndex]);

  const handleImageLoad = useCallback((index: number) => {
    setLoadedImages(prev => new Set(prev).add(index));
    setErrorImages(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  }, []);

  const handleImageError = useCallback((index: number) => {
    setErrorImages(prev => new Set(prev).add(index));
  }, []);

  // Determine if slide should be rendered
  const shouldRenderSlide = useCallback((index: number) => {
    const distance = Math.abs(index - currentIndex);
    
    // Always render current slide and immediate neighbors
    if (distance <= 1) return true;
    
    // Render visible slides
    if (visibleSlides.has(index)) return true;
    
    // Render next few slides for smooth scrolling
    if (distance <= 2) return true;
    
    return false;
  }, [currentIndex, visibleSlides]);

  return (
    <div className={className}>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {images.map((image, index) => (
            <div 
              key={image.id} 
              className="flex-none w-full h-full min-w-0"
              style={{ 
                // Optimize rendering for off-screen slides
                transform: shouldRenderSlide(index) ? 'none' : 'translateZ(0)',
                willChange: Math.abs(index - currentIndex) <= 1 ? 'transform' : 'auto'
              }}
            >
              {shouldRenderSlide(index) ? (
                <OptimizedCarouselImage
                  imageRecord={image}
                  title={`${artworkTitle} - Image ${index + 1}`}
                  priority={index === currentIndex}
                  isVisible={visibleSlides.has(index) || Math.abs(index - currentIndex) <= 1}
                  className="w-full h-full"
                  onLoad={() => handleImageLoad(index)}
                  onError={() => handleImageError(index)}
                />
              ) : (
                // Placeholder for non-rendered slides
                <div className="w-full h-full bg-muted/5 flex items-center justify-center">
                  <div className="w-12 h-12 bg-muted/20 rounded animate-pulse" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Performance info for development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
          Loaded: {loadedImages.size}/{images.length} | 
          Preloaded: {preloadedCount} | 
          {isPreloading && 'Preloading...'}
        </div>
      )}
    </div>
  );
}
