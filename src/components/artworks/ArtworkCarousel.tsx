
import { CarouselNavigation } from "./carousel/CarouselNavigation";
import { CarouselImage } from "./carousel/CarouselImage";
import { CarouselDownloadMenu } from "./carousel/CarouselDownloadMenu";
import { useArtworkCarousel } from "@/hooks/use-artwork-carousel";
import { useEffect } from "react";

interface ArtworkCarouselProps {
  artworkId: string;
  artistName?: string;
  artworkTitle?: string;
}

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
    emblaApi,
    handleDotClick,
  } = useArtworkCarousel(artworkId);
  
  // Re-initialize the carousel when images change
  useEffect(() => {
    if (emblaApi && images.length > 0) {
      emblaApi.reInit();
      // Ensure we're on the first slide when images change
      emblaApi.scrollTo(0);
    }
  }, [images, emblaApi]);
  
  if (loading) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-secondary/20">
        <p className="text-muted-foreground">Loading images...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-secondary/20">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }
  
  // Ensure we have at least one image to display, even if it's a placeholder
  const displayImages = images.length > 0 ? images : [{ 
    id: "placeholder", 
    artwork_id: artworkId, 
    image_url: "/placeholder.svg", 
    is_primary: true, 
    display_order: 0 
  }];

  return (
    <div className="relative">
      <div className="w-full group">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {displayImages.map((image, index) => (
              <CarouselImage
                key={image.id}
                imageUrl={image.image_url}
                index={index}
                totalImages={displayImages.length}
                artistName={artistName}
                artworkTitle={artworkTitle}
              />
            ))}
          </div>
        </div>

        {displayImages.length > 1 && (
          <>
            <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
              <button 
                onClick={() => emblaApi?.scrollPrev()} 
                className="h-8 w-8 rounded-full bg-white shadow-md flex items-center justify-center"
                aria-label="Previous image"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="m15 18-6-6 6-6"></path>
                </svg>
              </button>
            </div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
              <button 
                onClick={() => emblaApi?.scrollNext()} 
                className="h-8 w-8 rounded-full bg-white shadow-md flex items-center justify-center"
                aria-label="Next image"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="m9 18 6-6-6-6"></path>
                </svg>
              </button>
            </div>
            {/* Add the download button that appears on hover */}
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
