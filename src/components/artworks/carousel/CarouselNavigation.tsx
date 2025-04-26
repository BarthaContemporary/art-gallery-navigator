
import React from 'react';

interface CarouselNavigationProps {
  currentIndex: number;
  totalImages: number;
  onDotClick: (index: number) => void;
}

export function CarouselNavigation({
  currentIndex,
  totalImages,
  onDotClick
}: CarouselNavigationProps) {
  if (totalImages <= 1) return null;
  
  const renderDots = () => {
    return Array.from({ length: totalImages }, (_, index) => (
      <button
        key={index}
        onClick={() => onDotClick(index)}
        aria-label={`Go to slide ${index + 1}`}
        className={`w-2 h-2 rounded-full transition-colors ${
          currentIndex === index ? "bg-primary" : "bg-gray-300"
        }`}
      />
    ));
  };
  
  return (
    <div className="flex justify-center items-center w-full">
      <div className="flex gap-2">
        {renderDots()}
      </div>
    </div>
  );
}
