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
      <div className="bg-black/20 backdrop-blur-sm rounded-full flex items-center gap-2 py-1.5 px-3">
        {/* Counter */}
        <div className="text-white text-[10px] font-medium">
          {currentIndex + 1}/{totalImages}
        </div>
        
        {/* Progress bar */}
        <div className="w-12 h-1 bg-white/20 rounded-full overflow-hidden">
          <div 
            className="h-full bg-white rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / totalImages) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}