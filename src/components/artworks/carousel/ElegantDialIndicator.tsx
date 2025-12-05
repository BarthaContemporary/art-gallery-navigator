
import React from "react";
import { cn } from "@/lib/utils";

interface ElegantDialIndicatorProps {
  hasMultipleImages: boolean;
  currentIndex: number;
  totalImages: number;
  onScrollTo: (index: number) => void;
}

export function ElegantDialIndicator({
  hasMultipleImages,
  currentIndex,
  totalImages,
  onScrollTo,
}: ElegantDialIndicatorProps) {
  if (!hasMultipleImages) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
      <div className="relative bg-black/60 backdrop-blur-sm rounded-full p-5 flex items-center justify-center min-w-[80px]">
        {/* Counter Text */}
        <div className="text-white text-sm font-medium px-4">
          {currentIndex + 1} / {totalImages}
        </div>
        
        {/* Elegant Dial Background */}
        <div className="absolute inset-0 rounded-full">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="2"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth="2"
              strokeDasharray={`${(currentIndex + 1) / totalImages * 283} 283`}
              className="transition-all duration-300 ease-in-out"
            />
          </svg>
        </div>
        
        {/* Individual dots for each image */}
        <div className="absolute inset-0 rounded-full">
          {Array.from({ length: totalImages }, (_, index) => {
            const angle = (index / totalImages) * 360 - 90;
            const x = 50 + 40 * Math.cos((angle * Math.PI) / 180);
            const y = 50 + 40 * Math.sin((angle * Math.PI) / 180);
            
            return (
              <button
                key={index}
                className={cn(
                  "absolute w-1.5 h-1.5 rounded-full transition-all duration-200 hover:scale-125",
                  index === currentIndex 
                    ? "bg-white shadow-lg" 
                    : "bg-white/50 hover:bg-white/70"
                )}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                onClick={() => onScrollTo(index)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
