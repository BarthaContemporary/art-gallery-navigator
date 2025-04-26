
import { CarouselNavigation } from "./carousel/CarouselNavigation";
import { CarouselImage } from "./carousel/CarouselImage";
import { useArtworkCarousel } from "@/hooks/use-artwork-carousel";

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
  
  const displayImages = images.length > 0 ? images : [{ 
    id: "main", 
    artwork_id: artworkId, 
    image_url: "", 
    is_primary: true, 
    display_order: 0 
  }];

  return (
    <div className="relative">
      <div className="w-full">
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
              <button onClick={() => emblaApi?.scrollPrev()} className="h-8 w-8 rounded-full bg-white shadow-md flex items-center justify-center">
                <span className="sr-only">Previous slide</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="m15 18-6-6 6-6"></path>
                </svg>
              </button>
            </div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
              <button onClick={() => emblaApi?.scrollNext()} className="h-8 w-8 rounded-full bg-white shadow-md flex items-center justify-center">
                <span className="sr-only">Next slide</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="m9 18 6-6-6-6"></path>
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
      
      <CarouselNavigation
        currentIndex={currentIndex}
        totalImages={displayImages.length}
        onDotClick={handleDotClick}
      />
    </div>
  );
}
