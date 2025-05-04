
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";

interface ArtworkCardImageProps {
  imageUrl: string | null;
  title: string;
  onClick: () => void;
}

export function ArtworkCardImage({ imageUrl, title, onClick }: ArtworkCardImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [optimizedUrl, setOptimizedUrl] = useState<string | null>(null);

  useEffect(() => {
    // Reset loading state when image URL changes
    setIsLoading(true);
    
    if (!imageUrl) {
      setOptimizedUrl("/placeholder.svg");
      setIsLoading(false);
      return;
    }

    // For thumbnails in cards, use a smaller image size if possible
    if (imageUrl.includes('supabase.co/storage')) {
      // This could be enhanced with actual resize parameters if your storage supports it
      setOptimizedUrl(imageUrl);
    } else {
      setOptimizedUrl(imageUrl);
    }
  }, [imageUrl]);

  return (
    <div 
      className="aspect-[4/3] w-full overflow-hidden cursor-pointer relative"
      onClick={onClick}
    >
      <AspectRatio ratio={4/3}>
        {isLoading && (
          <Skeleton className="h-full w-full absolute inset-0" />
        )}
        <img
          src={optimizedUrl || "/placeholder.svg"}
          alt={title}
          className={`h-full w-full object-cover transition-all hover:scale-105 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setOptimizedUrl("/placeholder.svg");
            setIsLoading(false);
          }}
          loading="lazy"
          decoding="async"
          fetchPriority="high"
          width="400"
          height="300"
        />
      </AspectRatio>
    </div>
  );
}
