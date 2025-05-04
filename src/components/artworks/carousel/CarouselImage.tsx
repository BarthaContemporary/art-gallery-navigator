
import { useState, useEffect, useRef, memo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useImageCache } from "@/hooks/use-image-cache";

interface CarouselImageProps {
  imageUrl: string;
  index: number;
  totalImages: number;
  artistName?: string;
  artworkTitle?: string;
}

export const CarouselImage = memo(function CarouselImage({
  imageUrl,
  index,
  totalImages,
  artistName = "Unknown_Artist",
  artworkTitle = "Untitled"
}: CarouselImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [optimizedUrl, setOptimizedUrl] = useState<string>(imageUrl);
  const [placeholderUrl, setPlaceholderUrl] = useState<string | null>(null);
  const { getCachedImage, setCachedImage } = useImageCache();
  const imageLoadAttempted = useRef(false);
  const mountedRef = useRef(true);
  
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  
  useEffect(() => {
    // Only reset loading state if the image URL actually changes
    if (optimizedUrl !== imageUrl) {
      setIsLoading(true);
      setPlaceholderUrl(null);
      imageLoadAttempted.current = false;
    
      if (!imageUrl) {
        setOptimizedUrl("/placeholder.svg");
        setIsLoading(false);
        return;
      }
      
      // Check cache for placeholder
      const cachedImage = getCachedImage(imageUrl);
      if (cachedImage) {
        setPlaceholderUrl(cachedImage.dataUrl);
      }
      
      setOptimizedUrl(imageUrl);
    }
  }, [imageUrl, getCachedImage]);
  
  // Cache the loaded image at medium res if not already cached
  const cacheImageIfNeeded = () => {
    if (!optimizedUrl || optimizedUrl === "/placeholder.svg" || imageLoadAttempted.current) return;
    
    imageLoadAttempted.current = true;
    
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (!mountedRef.current) return;
        
        // Create a higher quality version for cache
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        const maxDimension = 1200; // reduced from 2400px for better performance
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);
        
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Using a lower JPEG quality for better performance
          const mediumResDataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setCachedImage(optimizedUrl, mediumResDataUrl);
        }
      };
      img.src = optimizedUrl;
    } catch (error) {
      console.error("Failed to cache image:", error);
    }
  };

  return (
    <div className="relative w-full flex-[0_0_100%]">
      {isLoading && (
        <Skeleton className="absolute inset-0" />
      )}
      
      {/* Show cached placeholder while loading */}
      {placeholderUrl && isLoading && (
        <img 
          src={placeholderUrl}
          alt="Loading preview"
          className="w-full h-[600px] object-contain opacity-70"
          aria-hidden="true"
        />
      )}
      
      <img
        src={optimizedUrl}
        alt={`${artworkTitle} by ${artistName} (${index + 1} of ${totalImages})`}
        className="w-full h-[600px] object-contain transition-opacity duration-300"
        style={{
          opacity: isLoading ? 0 : 1
        }}
        onLoad={() => {
          if (mountedRef.current) {
            setIsLoading(false);
            cacheImageIfNeeded();
          }
        }}
        onError={() => {
          if (mountedRef.current) {
            console.log(`Failed to load image: ${imageUrl}`);
            setOptimizedUrl("/placeholder.svg");
            setIsLoading(false);
          }
        }}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
});
