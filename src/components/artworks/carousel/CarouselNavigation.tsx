
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

  return (
    <div className="flex justify-center gap-2 mt-4">
      {Array.from({ length: totalImages }, (_, index) => (
        <button
          key={index}
          className={`h-2 w-2 rounded-full transition-colors ${
            index === currentIndex ? "bg-primary" : "bg-secondary"
          }`}
          onClick={() => onDotClick(index)}
          aria-label={`Go to slide ${index + 1}`}
        />
      ))}
    </div>
  );
}
