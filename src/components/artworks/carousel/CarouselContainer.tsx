
import React from "react";
import { LocalArtworkImage } from "../LocalArtworkImage";
import { LocalImageRecord } from "@/services/local-image-service";
import { cn } from "@/lib/utils";

interface CarouselContainerProps {
  sortedImages: LocalImageRecord[];
  artworkTitle: string;
  currentIndex: number;
  zoomLevel: number;
  isZoomed: boolean;
  emblaRef: (node: HTMLDivElement | null) => void;
}

export function CarouselContainer({
  sortedImages,
  artworkTitle,
  currentIndex,
  zoomLevel,
  isZoomed,
  emblaRef,
}: CarouselContainerProps) {
  return (
    <div className="h-full" ref={emblaRef}>
      <div className="flex h-full">
        {sortedImages.map((image, index) => (
          <div 
            key={image.id} 
            className={cn(
              "flex-none w-full h-full relative",
              // Hide non-current images when zoomed
              isZoomed && index !== currentIndex ? "hidden" : ""
            )}
          >
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
          </div>
        ))}
      </div>
    </div>
  );
}
