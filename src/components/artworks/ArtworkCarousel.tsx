
import { CarouselNavigation } from "./carousel/CarouselNavigation";
import { CarouselImage } from "./carousel/CarouselImage";
import { CarouselDownloadMenu } from "./carousel/CarouselDownloadMenu";
import { useArtworkCarousel } from "@/hooks/use-artwork-carousel";
import { useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2 } from "lucide-react";

interface ArtworkCarouselProps {
  artworkId: string;
  artistName?: string;
  artworkTitle?: string;
  isDialogActive?: boolean; 
}

export function ArtworkCarousel({ 
  artworkId,
  artistName = "Unknown_Artist",
  artworkTitle = "Untitled",
  isDialogActive = false 
}: ArtworkCarouselProps) {
  const {
    images,
    currentIndex,
    loading,
    error,
    emblaRef,
    emblaApi,
    handleDotClick,
    scrollPrev,
    scrollNext,
  } = useArtworkCarousel(artworkId, isDialogActive);
  
  const carouselWrapperRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const carouselHeightClass = isMobile ? "h-[350px]" : "h-[600px]";

  // Re-initialize the carousel when images change
  useEffect(() => {
    if (emblaApi && images.length > 0) {
      const timer = setTimeout(() => {
        emblaApi.reInit();
        emblaApi.scrollTo(0);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [images, emblaApi]);

  // Keyboard navigation handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!emblaApi || !isDialogActive) return;

      const targetElement = event.target as HTMLElement;
      const isInputFocused =
        targetElement.tagName === 'INPUT' ||
        targetElement.tagName === 'TEXTAREA' ||
        targetElement.isContentEditable;

      if (isInputFocused) return;
      
      if (event.key === "ArrowLeft") {
        event.preventDefault(); 
        scrollPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault(); 
        scrollNext();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [emblaApi, scrollPrev, scrollNext, isDialogActive]);

  if (loading) {
    return (
      <div className={`w-full ${carouselHeightClass} flex items-center justify-center bg-secondary/20`}>
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-muted-foreground">Loading images...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={`w-full ${carouselHeightClass} flex items-center justify-center bg-secondary/20`}>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }
  
  // Show placeholder when no images are found
  const displayImages = images.length > 0 ? images : [{ 
    id: "placeholder", 
    artwork_id: artworkId, 
    image_url: "/placeholder.svg", 
    is_primary: true, 
    display_order: 0 
  }];

  return (
    <div 
      className="relative" 
      ref={carouselWrapperRef} 
      tabIndex={0} 
      aria-roledescription="carousel" 
    >
      <div className="w-full group">
        {/* Embla viewport */}
        <div className={`overflow-hidden ${carouselHeightClass}`} ref={emblaRef}>
          {/* Embla container */}
          <div className={`flex h-full`} aria-live="polite"> 
            {displayImages.map((image, index) => (
              <CarouselImage
                key={`${image.id}-${artworkId}`}
                imageUrl={image.image_url}
                index={index}
                totalImages={displayImages.length}
                artistName={artistName}
                artworkTitle={artworkTitle}
                role="group" 
                ariaRoledescription="slide"
                ariaLabel={`Slide ${index + 1} of ${displayImages.length}`}
                carouselHeightClass={carouselHeightClass}
              />
            ))}
          </div>
        </div>

        {displayImages.length > 1 && (
          <>
            <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
              <button 
                onClick={scrollPrev} 
                className="h-8 w-8 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-gray-50"
                aria-label="Previous image"
                type="button"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="m15 18-6-6 6-6"></path>
                </svg>
              </button>
            </div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
              <button 
                onClick={scrollNext} 
                className="h-8 w-8 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-gray-50"
                aria-label="Next image"
                type="button"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="m9 18 6-6-6-6"></path>
                </svg>
              </button>
            </div>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <CarouselDownloadMenu 
                images={displayImages}
                artistName={artistName}
                artworkTitle={artworkTitle}
              />
            </div>
          </>
        )}
      </div>

      <div className="mt-4 flex justify-between items-center">
        <CarouselNavigation
          currentIndex={currentIndex}
          totalImages={displayImages.length}
          onDotClick={handleDotClick}
        />
      </div>
    </div>
  );
}
