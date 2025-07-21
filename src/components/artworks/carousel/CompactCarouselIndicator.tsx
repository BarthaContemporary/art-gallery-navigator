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
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <div className="bg-black/20 backdrop-blur-sm rounded-full flex items-center gap-0.5 py-0.5 px-1">
        {/* Tiny counter */}
        <div className="text-white text-[8px] font-medium">
          {currentIndex + 1}/{totalImages}
        </div>
        
        {/* Micro dots */}
        <div className="flex items-center gap-px ml-0.5">
          {Array.from({ length: totalImages }, (_, index) => (
            <button
              key={index}
              onClick={() => onScrollTo(index)}
              aria-label={`Go to image ${index + 1}`}
              className={cn(
                "w-0.5 h-0.5 rounded-full transition-all duration-200",
                index === currentIndex 
                  ? "bg-white" 
                  : "bg-white/40"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}