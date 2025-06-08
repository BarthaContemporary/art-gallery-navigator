
import { Loader2 } from "lucide-react";

interface CarouselImageLoaderProps {
  isLoading: boolean;
  isProcessing: boolean;
  carouselHeightClass: string;
}

export function CarouselImageLoader({
  isLoading,
  isProcessing,
  carouselHeightClass,
}: CarouselImageLoaderProps) {
  if (!isLoading && !isProcessing) return null;

  return (
    <div className={`absolute inset-0 flex items-center justify-center ${carouselHeightClass} bg-muted/20 z-10`}>
      <div className="flex flex-col items-center gap-2 bg-background/80 p-4 rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {isProcessing ? "Optimizing image..." : "Loading image..."}
        </p>
      </div>
    </div>
  );
}
