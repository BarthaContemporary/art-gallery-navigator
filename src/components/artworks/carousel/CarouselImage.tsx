
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface CarouselImageProps {
  imageUrl: string;
  index: number;
  totalImages: number;
  artistName?: string;
  artworkTitle?: string;
}

export function CarouselImage({
  imageUrl,
  index,
  totalImages,
  artistName = "Unknown_Artist",
  artworkTitle = "Untitled"
}: CarouselImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [optimizedUrl, setOptimizedUrl] = useState<string>(imageUrl);

  useEffect(() => {
    // Reset loading state when image URL changes
    setIsLoading(true);
    
    if (!imageUrl) {
      setOptimizedUrl("/placeholder.svg");
      setIsLoading(false);
      return;
    }
    
    // Add smaller size parameter for thumbnails if using Supabase storage
    if (imageUrl.includes('supabase.co/storage')) {
      // Use width transformation parameter if available in your setup
      // This is a placeholder for potential CDN transformations
      setOptimizedUrl(imageUrl);
    } else {
      setOptimizedUrl(imageUrl);
    }
  }, [imageUrl]);

  return (
    <div className="relative w-full flex-[0_0_100%]">
      {isLoading && (
        <Skeleton className="absolute inset-0" />
      )}
      <img
        src={optimizedUrl}
        alt={`${artworkTitle} by ${artistName} (${index + 1} of ${totalImages})`}
        className={`w-full h-[600px] object-contain transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setOptimizedUrl("/placeholder.svg");
          setIsLoading(false);
        }}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
