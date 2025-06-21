
import React from "react";
import { CircleDot } from "lucide-react";
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
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <div className="bg-black/50 backdrop-blur-sm rounded-full flex items-center gap-1 py-0.5 px-1.5">
        {/* Counter */}
        <div className="text-white text-xs font-medium">
          {currentIndex + 1}/{totalImages}
        </div>
        
        {/* Circle dot icons */}
        <div className="flex items-center gap-0.5">
          {Array.from({
            length: totalImages
          }, (_, index) => (
            <button
              key={index}
              onClick={() => onScrollTo(index)}
              aria-label={`Go to image ${index + 1}`}
              className="flex items-center justify-center"
            >
              <CircleDot size={10} className="text-white" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
