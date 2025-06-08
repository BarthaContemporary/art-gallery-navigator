
import { memo, useRef } from "react";
import { CarouselImageControls } from "./CarouselImageControls";
import { CarouselImageLoader } from "./CarouselImageLoader";
import { useCarouselImageLogic } from "./useCarouselImageLogic";

interface CarouselImageProps {
  imageUrl: string;
  imageId?: string;
  index: number;
  totalImages: number;
  artistName?: string;
  artworkTitle?: string;
  role?: string;
  ariaRoledescription?: string;
  ariaLabel?: string;
  carouselHeightClass?: string; 
}

export const CarouselImage = memo(function CarouselImage({
  imageUrl,
  imageId,
  index,
  totalImages,
  artistName = "Unknown_Artist",
  artworkTitle = "Untitled",
  role,
  ariaRoledescription,
  ariaLabel,
  carouselHeightClass = "h-[600px]", 
}: CarouselImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  
  const {
    isLoading,
    hasError,
    finalImageUrl,
    isZoomed,
    isProcessing,
    displayUrl,
    handleImageLoad,
    handleImageError,
    handleImageClick,
    toggleZoom,
  } = useCarouselImageLogic({ imageUrl, imageId });

  const showControls = !isLoading && !isProcessing && !hasError && finalImageUrl && finalImageUrl !== "/placeholder.svg";

  return (
    <div 
      className={`relative w-full flex-[0_0_100%] ${carouselHeightClass} group`}
      role={role}
      aria-roledescription={ariaRoledescription}
      aria-label={ariaLabel}
    >
      <CarouselImageLoader
        isLoading={isLoading}
        isProcessing={isProcessing}
        carouselHeightClass={carouselHeightClass}
      />
      
      <CarouselImageControls
        isVisible={showControls}
        isZoomed={isZoomed}
        onToggleZoom={toggleZoom}
      />
      
      {/* Main image container */}
      <div 
        className={`w-full ${carouselHeightClass} overflow-hidden cursor-pointer ${
          isZoomed ? 'overflow-auto' : ''
        }`}
        onClick={handleImageClick}
      >
        <img
          ref={imageRef}
          src={displayUrl}
          alt={`${artworkTitle} by ${artistName} (${index + 1} of ${totalImages})`}
          className={`transition-all duration-300 ${
            isLoading || isProcessing ? 'opacity-0' : 'opacity-100'
          } ${
            isZoomed 
              ? 'w-auto h-auto min-w-full min-h-full object-contain cursor-zoom-out scale-150 origin-center' 
              : `w-full ${carouselHeightClass} object-contain cursor-zoom-in hover:scale-105`
          }`}
          onLoad={handleImageLoad}
          onError={handleImageError}
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
});
