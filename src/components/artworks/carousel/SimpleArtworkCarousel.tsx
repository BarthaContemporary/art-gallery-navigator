
import { useCarouselImageLogic } from "./useCarouselImageLogic";
import { CarouselImageLoader } from "./CarouselImageLoader";
import { CarouselNavigation } from "./CarouselNavigation";
import { CarouselImageControls } from "./CarouselImageControls";

interface SimpleArtworkCarouselProps {
  artworkId: string;
  artistName?: string;
  artworkTitle?: string;
  isDialogActive?: boolean;
}

export function SimpleArtworkCarousel({
  artworkId,
  artistName = "Unknown_Artist",
  artworkTitle = "Untitled",
  isDialogActive = false
}: SimpleArtworkCarouselProps) {
  const {
    images,
    currentIndex,
    loading,
    error,
    imageLoadingStates,
    imageErrors,
    zoomedIndex,
    goToPrevious,
    goToNext,
    goToSlide,
    handleImageLoad,
    handleImageError,
    handleImageLoadStart,
    toggleZoom,
  } = useCarouselImageLogic(artworkId, isDialogActive);

  if (loading) {
    return (
      <div className="w-full h-[350px] md:h-[600px] flex items-center justify-center bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading images...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[350px] md:h-[600px] flex items-center justify-center bg-muted/20">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  // Use placeholder if no images
  const displayImages = images.length > 0 ? images : [{
    id: "placeholder",
    artwork_id: artworkId,
    image_url: "/placeholder.svg",
    is_primary: true,
    display_order: 0
  }];

  const currentImage = displayImages[currentIndex];
  const isZoomed = zoomedIndex === currentIndex;

  return (
    <div className="relative w-full">
      {/* Main image container */}
      <div className="relative w-full h-[350px] md:h-[600px] bg-muted/20 rounded-lg overflow-hidden group">
        {/* Image */}
        <div 
          className={`w-full h-full overflow-hidden cursor-pointer ${
            isZoomed ? 'overflow-auto' : ''
          }`}
          onClick={() => toggleZoom(currentIndex)}
        >
          <CarouselImageLoader
            imageId={currentImage.id}
            imageUrl={currentImage.image_url}
            altText={`${artworkTitle} by ${artistName} (${currentIndex + 1} of ${displayImages.length})`}
            isZoomed={isZoomed}
            isLoading={!!imageLoadingStates[currentImage.id]}
            hasError={!!imageErrors[currentImage.id]}
            onLoadStart={() => handleImageLoadStart(currentImage.id)}
            onLoad={() => handleImageLoad(currentImage.id)}
            onError={() => handleImageError(currentImage.id)}
            onToggleZoom={() => toggleZoom(currentIndex)}
          />
        </div>

        {/* Navigation arrows */}
        <CarouselNavigation
          hasMultipleImages={displayImages.length > 1}
          onPrevious={goToPrevious}
          onNext={goToNext}
        />

        {/* Controls */}
        <CarouselImageControls
          isZoomed={isZoomed}
          currentImageUrl={currentImage.image_url}
          hasImages={displayImages.length > 0}
          images={displayImages}
          artistName={artistName}
          artworkTitle={artworkTitle}
          onToggleZoom={() => toggleZoom(currentIndex)}
        />
      </div>

      {/* Navigation dots */}
      {displayImages.length > 1 && (
        <div className="flex justify-center mt-3">
          <div className="flex gap-2">
            {displayImages.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
                className={`transition-all duration-200 hover:scale-150 rounded-full ${
                  currentIndex === index 
                    ? "bg-primary w-2 h-2" 
                    : "bg-gray-300 hover:bg-gray-400 w-1.5 h-1.5"
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
