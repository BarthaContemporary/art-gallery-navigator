
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
  onScrollTo,
}: CompactCarouselIndicatorProps) {
  if (!hasMultipleImages) return null;

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <div className="bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-2">
        {/* Counter */}
        <div className="text-white text-xs font-medium">
          {currentIndex + 1}/{totalImages}
        </div>
        
        {/* Tiny dots */}
        <div className="flex items-center gap-1">
          {Array.from({ length: totalImages }, (_, index) => (
            <button
              key={index}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all duration-200 hover:scale-125",
                index === currentIndex 
                  ? "bg-white" 
                  : "bg-white/40 hover:bg-white/60"
              )}
              onClick={() => onScrollTo(index)}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
