
import { useState, useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useImageCache } from "@/hooks/use-image-cache";

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
  const [placeholderUrl, setPlaceholderUrl] = useState<string | null>(null);
  const { getCachedImage, setCachedImage } = useImageCache();
  const imageLoadAttempted = useRef(false);
  
  useEffect(() => {
    // Reset loading state when image URL changes
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
      // We'll still load the full image, but with a nice placeholder
    }
    
    // Add smaller size parameter for thumbnails if using Supabase storage
    if (imageUrl.includes('supabase.co/storage')) {
      // Use width transformation parameter if available in your setup
      // This is a placeholder for potential CDN transformations
      setOptimizedUrl(imageUrl);
    } else {
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
        // Create a medium quality version for cache
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        // Use a slightly larger size for better quality in the carousel
        const maxDimension = 300; // Increased from previous implementation
        const scale = maxDimension / Math.max(img.width, img.height);
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);
        
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const mediumResDataUrl = canvas.toDataURL("image/jpeg", 0.75); // Better quality
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
          className="w-full h-[600px] object-contain opacity-50 filter blur-[1px]" // Reduced blur, increased opacity
          aria-hidden="true"
        />
      )}
      
      <img
        src={optimizedUrl}
        alt={`${artworkTitle} by ${artistName} (${index + 1} of ${totalImages})`}
        className={`w-full h-[600px] object-contain transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
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
    </div>
  );
}
