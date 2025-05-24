
import { CarouselNavigation } from "./carousel/CarouselNavigation";
import { CarouselImage } from "./carousel/CarouselImage";
import { CarouselDownloadMenu } from "./carousel/CarouselDownloadMenu";
import { useArtworkCarousel } from "@/hooks/use-artwork-carousel";
import { useEffect, useRef, useCallback } from "react"; // Added useCallback

interface ArtworkCarouselProps {
  artworkId: string;
  artistName?: string;
  artworkTitle?: string;
}

/**
 * Renders an image carousel for an artwork, supporting mouse, touch, and keyboard navigation.
 * Includes loading/error states, navigation dots, and an optional download menu.
 *
 * @param artworkId The ID of the artwork.
 * @param artistName Optional name of the artist for image alt text.
 * @param artworkTitle Optional title of the artwork for image alt text.
 */
export function ArtworkCarousel({ 
  artworkId,
  artistName = "Unknown_Artist",
  artworkTitle = "Untitled"
}: ArtworkCarouselProps) {
  const {
    images,
    currentIndex,
    loading,
    error,
    emblaRef,
    emblaApi, // Keep emblaApi for direct access if needed for prev/next buttons
    handleDotClick,
    scrollPrev, // Use dedicated scrollPrev from hook
    scrollNext, // Use dedicated scrollNext from hook
  } = useArtworkCarousel(artworkId);
  
  const carouselWrapperRef = useRef<HTMLDivElement>(null);
  
  // Re-initialize the carousel when images change
  useEffect(() => {
    if (emblaApi && images.length > 0) {
      const timer = setTimeout(() => {
        emblaApi.reInit();
        emblaApi.scrollTo(0);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [images, emblaApi]); // images.length could also be used if images array identity is stable

  // Keyboard navigation handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!carouselWrapperRef.current || !emblaApi) return;

      const targetElement = event.target as HTMLElement;
      const isInputFocused =
        targetElement.tagName === 'INPUT' ||
        targetElement.tagName === 'TEXTAREA' ||
        targetElement.isContentEditable;

      if (isInputFocused) {
        return;
      }
      
      // Check if the carousel wrapper itself or one of its children has focus.
      const isCarouselFocusedOrContainsFocus =
        document.activeElement === carouselWrapperRef.current ||
        carouselWrapperRef.current.contains(document.activeElement);

      if (isCarouselFocusedOrContainsFocus) {
        if (event.key === "ArrowLeft") {
          event.preventDefault(); // Prevent browser scroll
          scrollPrev();
        } else if (event.key === "ArrowRight") {
          event.preventDefault(); // Prevent browser scroll
          scrollNext();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [emblaApi, scrollPrev, scrollNext, carouselWrapperRef]); // carouselWrapperRef is stable

  if (loading) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-secondary/20">
        <p className="text-muted-foreground">Loading images...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-secondary/20">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }
  
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
      ref={carouselWrapperRef} // Use the ref for the outer wrapper
      tabIndex={0} // Make the carousel focusable
      aria-roledescription="carousel" // ARIA role description
    >
      <div className="w-full group">
        {/* Embla viewport */}
        <div className="overflow-hidden h-[600px]" ref={emblaRef}>
          {/* Embla container */}
          <div className="flex h-full" aria-live="polite"> {/* Announce slide changes */}
            {displayImages.map((image, index) => (
              <CarouselImage
                key={image.id}
                imageUrl={image.image_url}
                index={index}
                totalImages={displayImages.length}
                artistName={artistName}
                artworkTitle={artworkTitle}
                // ARIA props for each slide item
                role="group" // As per WAI-ARIA practices for carousel items
                ariaRoledescription="slide"
                ariaLabel={`Slide ${index + 1} of ${displayImages.length}`}
              />
            ))}
          </div>
        </div>

        {displayImages.length > 1 && (
          <>
            <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
              <button 
                onClick={() => emblaApi?.scrollPrev()} // Or use scrollPrev from hook
                className="h-8 w-8 rounded-full bg-white shadow-md flex items-center justify-center"
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
                onClick={() => emblaApi?.scrollNext()} // Or use scrollNext from hook
                className="h-8 w-8 rounded-full bg-white shadow-md flex items-center justify-center"
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
