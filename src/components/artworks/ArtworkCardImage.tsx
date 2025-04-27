
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
    if (!imageUrl) {
      setOptimizedUrl("/placeholder.svg");
      return;
    }

    // Use the original URL when no optimized version is available
    setOptimizedUrl(imageUrl);
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
          loading="lazy"
          style={{ maxWidth: '400px' }} // Limit display size to thumbnail dimensions
        />
      </AspectRatio>
    </div>
  );
}
