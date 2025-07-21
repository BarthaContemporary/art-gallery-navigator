import React from "react";
import { cn } from "@/lib/utils";

interface CompactCarouselIndicatorProps {
  hasMultipleImages: boolean;
  currentIndex: number;
  totalImages: number;
  onScrollTo: (index: number) => void;
}

export function CompactCarouselIndicator({
  hasMultipleImages,
  currentIndex,
  totalImages,
  onScrollTo
}: CompactCarouselIndicatorProps) {
  if (!hasMultipleImages) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-60 group-hover:opacity-100 transition-opacity duration-200">
      <div className="bg-black/40 backdrop-blur-sm rounded-full flex items-center gap-1 py-1.5 px-3">
        {/* Counter */}
        <div className="text-white text-xs font-medium mr-1">
          {currentIndex + 1}/{totalImages}
        </div>
        
        {/* Modern dots */}
        <div className="flex items-center gap-1">
          {Array.from({ length: totalImages }, (_, index) => (
            <button
              key={index}
              onClick={() => onScrollTo(index)}
              aria-label={`Go to image ${index + 1}`}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all duration-200 hover:scale-125",
                index === currentIndex 
                  ? "bg-white" 
                  : "bg-white/40 hover:bg-white/60"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}