
import { useState, useEffect, useRef, memo, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useImageCache } from "@/hooks/use-image-cache";

interface CarouselImageProps {
  imageUrl: string;
  index: number;
  totalImages: number;
  artistName?: string;
  artworkTitle?: string;
  // ARIA attributes for accessibility
  role?: string;
  ariaRoledescription?: string;
  ariaLabel?: string;
}

/**
 * Displays a single image within the carousel.
 * Handles image loading, placeholder, caching, and displays skeleton loaders.
 * Includes ARIA attributes for accessibility.
 *
 * @param imageUrl URL of the image to display.
 * @param index Current index of this image in the carousel.
 * @param totalImages Total number of images in the carousel.
 * @param artistName Optional artist name for alt text.
 * @param artworkTitle Optional artwork title for alt text.
 * @param role ARIA role for the slide item.
 * @param ariaRoledescription ARIA role description for the slide item.
 * @param ariaLabel ARIA label for the slide item, e.g., "Slide 1 of 5".
 */
export const CarouselImage = memo(function CarouselImage({
  imageUrl,
  index,
  totalImages,
  artistName = "Unknown_Artist",
  artworkTitle = "Untitled",
  role,
  ariaRoledescription,
  ariaLabel
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
    // This effect runs when imageUrl (the prop) changes.
    // It resets loading states and attempts to load a cached placeholder.
    // Then it sets optimizedUrl to the new imageUrl, triggering the image load.
    setIsLoading(true);
    setPlaceholderUrl(null);
    imageLoadAttempted.current = false; // Reset attempt flag for the new image
  
    if (!imageUrl) {
      setOptimizedUrl("/placeholder.svg"); // Fallback if no URL
      setIsLoading(false);
      return;
    }
    
    const cachedImage = getCachedImage(imageUrl); // Check cache using the original imageUrl
    if (cachedImage) {
      setPlaceholderUrl(cachedImage.dataUrl); // Use cached data as placeholder
    }
    
    setOptimizedUrl(imageUrl); // Set the URL to be loaded by the <img> tag
    
  }, [imageUrl, getCachedImage]); // Removed optimizedUrl from dependencies here as it causes re-runs we want to control better
  
  const cacheImageIfNeeded = useCallback(() => {
    if (!optimizedUrl || optimizedUrl === "/placeholder.svg" || imageLoadAttempted.current) return;
    
    imageLoadAttempted.current = true;
    
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (!mountedRef.current) return;
        
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        const maxDimension = 1800; // Increased max dimension for cached image
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);
        
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const mediumResDataUrl = canvas.toDataURL("image/jpeg", 0.92); // Increased quality
          // Cache using the original imageUrl as the key, but store the processed dataUrl
          setCachedImage(imageUrl, mediumResDataUrl); 
        }
      };
      img.src = optimizedUrl; // This is the original imageUrl passed for processing
    } catch (error) {
      console.error("Failed to cache image:", error);
    }
  }, [optimizedUrl, setCachedImage, imageUrl]); // Added imageUrl to ensure the correct key is used for caching

  return (
    <div 
      className="relative w-full flex-[0_0_100%]"
      role={role}
      aria-roledescription={ariaRoledescription}
      aria-label={ariaLabel}
    >
      {isLoading && (
        <Skeleton className="absolute inset-0" />
      )}
      
      {placeholderUrl && isLoading && (
        <img 
          src={placeholderUrl}
          alt="Loading preview"
          className="w-full h-[600px] object-contain opacity-70"
          aria-hidden="true"
        />
      )}
      
      <img
        src={optimizedUrl} // This will be the original imageUrl
        alt={`${artworkTitle} by ${artistName} (${index + 1} of ${totalImages})`}
        className="w-full h-[600px] object-contain transition-opacity duration-300"
        style={{
          opacity: isLoading ? 0 : 1
        }}
        onLoad={() => {
          if (mountedRef.current) {
            setIsLoading(false);
            // Attempt to cache after the original image has successfully loaded
            // This ensures we cache the version that was confirmed to be loadable
            if (optimizedUrl !== "/placeholder.svg") { // Don't cache the placeholder itself
                 cacheImageIfNeeded();
            }
          }
        }}
        onError={() => {
          if (mountedRef.current) {
            console.warn(`Failed to load image: ${imageUrl}. Falling back to placeholder.`);
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

