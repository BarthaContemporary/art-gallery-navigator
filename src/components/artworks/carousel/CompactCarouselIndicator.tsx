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
      <div className="bg-black/30 backdrop-blur-sm rounded-full flex items-center gap-0.5 py-0.5 px-1.5">
        {/* Counter */}
        <div className="text-white text-[10px] font-medium">
          {currentIndex + 1}/{totalImages}
        </div>
        
        {/* Mini dots */}
        <div className="flex items-center gap-0.5 ml-1">
          {Array.from({ length: totalImages }, (_, index) => (
            <button
              key={index}
              onClick={() => onScrollTo(index)}
              aria-label={`Go to image ${index + 1}`}
              className={cn(
                "w-1 h-1 rounded-full transition-all duration-200 hover:scale-150",
                index === currentIndex 
                  ? "bg-white" 
                  : "bg-white/50 hover:bg-white/70"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}