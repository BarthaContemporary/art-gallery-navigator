
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useRef } from "react";
import { useImageCache } from "@/hooks/use-image-cache";

interface ArtworkCardImageProps {
  imageUrl: string | null;
  title: string;
  onClick: () => void;
}

export function ArtworkCardImage({ imageUrl, title, onClick }: ArtworkCardImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [optimizedUrl, setOptimizedUrl] = useState<string | null>(null);
  const [placeholderUrl, setPlaceholderUrl] = useState<string | null>(null);
  const { getCachedImage, setCachedImage } = useImageCache();
  const imageLoadAttempted = useRef(false);

  useEffect(() => {
    // Reset states when image URL changes
    setIsLoading(true);
    setPlaceholderUrl(null);
    imageLoadAttempted.current = false;
    
    if (!imageUrl) {
      setOptimizedUrl("/placeholder.svg");
      setIsLoading(false);
      return;
    }

    // Check cache first
    const cachedImage = getCachedImage(imageUrl);
    if (cachedImage) {
      setPlaceholderUrl(cachedImage.dataUrl);
      // Still load the full image but with a nice placeholder
    }

    // For thumbnails in cards, use a smaller image size if possible
    if (imageUrl.includes('supabase.co/storage')) {
      // This could be enhanced with actual resize parameters if your storage supports it
      setOptimizedUrl(imageUrl);
    } else {
      setOptimizedUrl(imageUrl);
    }
  }, [imageUrl, getCachedImage]);

  // Function to create and cache a medium-res version using a canvas
  const cacheImageIfNeeded = () => {
    if (!optimizedUrl || optimizedUrl === "/placeholder.svg" || imageLoadAttempted.current) return;
    
    imageLoadAttempted.current = true;
    
    try {
      const img = new Image();
      img.crossOrigin = "anonymous"; // This is needed for some external images
      img.onload = () => {
        // Create a higher-quality version for cache with increased dimensions
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        // Increased max dimension for card thumbnails to 1000px
        const maxDimension = 1000;
        const scale = maxDimension / Math.max(img.width, img.height);
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);
        
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Using maximum JPEG quality of 1.0
          const mediumResDataUrl = canvas.toDataURL("image/jpeg", 1.0);
          setCachedImage(optimizedUrl, mediumResDataUrl);
        }
      };
      img.src = optimizedUrl;
    } catch (error) {
      console.error("Failed to cache image:", error);
    }
  };

  return (
    <div 
      className="aspect-[4/3] w-full overflow-hidden cursor-pointer relative group"
      onClick={onClick}
    >
      <AspectRatio ratio={4/3}>
        {isLoading && (
          <Skeleton className="h-full w-full absolute inset-0" />
        )}
        
        {/* Show cached placeholder while loading - removed blur filter */}
        {placeholderUrl && isLoading && (
          <img 
            src={placeholderUrl}
            alt={`Loading ${title}`}
            className="h-full w-full object-cover opacity-70"
            aria-hidden="true"
          />
        )}
        
        <img
          src={optimizedUrl || "/placeholder.svg"}
          alt={title}
          className={`h-full w-full object-cover transition-all duration-300 opacity-80 group-hover:opacity-100 group-hover:scale-105 ${
            isLoading ? 'opacity-0' : ''
          }`}
          onLoad={() => {
            setIsLoading(false);
            cacheImageIfNeeded();
          }}
          onError={() => {
            setOptimizedUrl("/placeholder.svg");
            setIsLoading(false);
          }}
          loading="lazy"
          decoding="async"
        />
      </AspectRatio>
    </div>
  );
}
