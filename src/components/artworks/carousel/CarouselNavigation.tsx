
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CarouselNavigationProps {
  hasMultipleImages: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

export function CarouselNavigation({
  hasMultipleImages,
  onPrevious,
  onNext,
}: CarouselNavigationProps) {
  if (!hasMultipleImages) return null;

  return (
    <>
      <button
        onClick={onPrevious}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background shadow-md flex items-center justify-center hover:bg-accent transition-colors"
        aria-label="Previous image"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      
      <button
        onClick={onNext}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background shadow-md flex items-center justify-center hover:bg-accent transition-colors"
        aria-label="Next image"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </>
  );
}
