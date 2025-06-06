import { useState, useEffect, useRef, memo, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useImageCache } from "@/hooks/use-image-cache";
import { logger } from "@/lib/logger";
import { Loader2 } from "lucide-react";

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
  carouselHeightClass?: string; 
}

export const CarouselImage = memo(function CarouselImage({
  imageUrl,
  index,
  totalImages,
  artistName = "Unknown_Artist",
  artworkTitle = "Untitled",
  role,
  ariaRoledescription,
  ariaLabel,
  carouselHeightClass = "h-[600px]", 
}: CarouselImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [optimizedUrl, setOptimizedUrl] = useState<string>("/placeholder.svg");
  const [placeholderUrl, setPlaceholderUrl] = useState<string | null>(null);
  const { getCachedImage, setCachedImage } = useImageCache();
  const imageLoadAttempted = useRef(false);
  const mountedRef = useRef(true);
  
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  
  useEffect(() => {
    if (!mountedRef.current) return;

    setIsLoading(true);
    imageLoadAttempted.current = false; 
  
    if (!imageUrl) {
      logger.debug(`CarouselImage: No imageUrl provided for index ${index}, using default placeholder.`);
      setPlaceholderUrl(null);
      setOptimizedUrl("/placeholder.svg");
      setIsLoading(false);
      return;
    }
    
    const cachedData = getCachedImage(imageUrl);
    if (cachedData) {
      logger.debug(`CarouselImage: Found cached placeholder for ${imageUrl} (index ${index})`);
      setPlaceholderUrl(cachedData.dataUrl);
    } else {
      setPlaceholderUrl(null);
    }
    
    let finalOptimizedUrl = imageUrl;
    if (imageUrl.includes('res.cloudinary.com')) {
      // Already a Cloudinary URL, use it directly with carousel-optimized transforms
      const baseUrl = imageUrl.split('/upload/')[0];
      const imagePath = imageUrl.split('/upload/')[1];
      finalOptimizedUrl = `${baseUrl}/upload/w_1920,h_1080,c_limit,q_90,f_webp/${imagePath}`;
      logger.debug(`CarouselImage: Using optimized Cloudinary URL for index ${index}: ${finalOptimizedUrl}`);
    } else if (imageUrl.includes('supabase.co/storage') && imageUrl.includes('/public/')) {
      // Supabase storage URL - apply transforms for backwards compatibility
      const transformParams = "w=1920&h=1080&resize=contain&q=90&f=auto";
      if (imageUrl.includes('?')) {
        finalOptimizedUrl = `${imageUrl}&transform=${transformParams}`;
      } else {
        finalOptimizedUrl = `${imageUrl}?transform=${transformParams}`;
      }
      logger.debug(`CarouselImage: Applying Supabase transform for index ${index}. Original: ${imageUrl}, Optimized: ${finalOptimizedUrl}`);
    } else {
      logger.debug(`CarouselImage: No transformation applied for ${imageUrl} (index ${index})`);
    }
    setOptimizedUrl(finalOptimizedUrl);
    
  }, [imageUrl, getCachedImage, index]);
  
  const cacheImageIfNeeded = useCallback(() => {
    if (!mountedRef.current || !imageUrl || !optimizedUrl || optimizedUrl === "/placeholder.svg" || imageLoadAttempted.current) return;
    
    imageLoadAttempted.current = true;
    logger.debug(`CarouselImage: Attempting to cache image. Original Key: ${imageUrl}, Source for Cache: ${optimizedUrl} (index ${index})`);
    
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (!mountedRef.current) return;
        
        logger.debug(`CarouselImage: Image loaded for caching (source: ${optimizedUrl}), creating canvas placeholder for index ${index}.`);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        const maxDimension = 1800; 
        let scale = 1;
        if (img.width > 0 && img.height > 0) {
            scale = maxDimension / Math.max(img.width, img.height);
            scale = Math.min(1, scale); 
            if (scale <= 0) scale = 1;
        } else {
            canvas.width = Math.min(maxDimension, img.width || maxDimension);
            canvas.height = Math.min(maxDimension, img.height || maxDimension);
        }
        
        if (img.width > 0 && img.height > 0) {
            canvas.width = Math.floor(img.width * scale);
            canvas.height = Math.floor(img.height * scale);
        } else {
            canvas.width = maxDimension / 2; 
            canvas.height = maxDimension / 2;
        }
        
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const mediumResDataUrl = canvas.toDataURL("image/jpeg", 0.92); 
          setCachedImage(imageUrl, mediumResDataUrl); 
          logger.log(`CarouselImage: Cached placeholder for ${imageUrl} (from ${optimizedUrl}, index ${index}). Size: ${mediumResDataUrl.length}`);
        }
      };
      img.onerror = () => {
          if (!mountedRef.current) return;
          logger.error(`CarouselImage: Failed to load image for caching: ${optimizedUrl} (index ${index})`);
      }
      img.src = optimizedUrl; 
    } catch (error) {
      logger.error(`CarouselImage: Failed to cache image for placeholder (index ${index}):`, error);
    }
  }, [optimizedUrl, setCachedImage, imageUrl, index]);

  return (
    <div 
      className={`relative w-full flex-[0_0_100%] ${carouselHeightClass}`}
      role={role}
      aria-roledescription={ariaRoledescription}
      aria-label={ariaLabel}
    >
      {isLoading ? (
        placeholderUrl ? (
          <img 
            src={placeholderUrl}
            alt={`Loading preview for ${artworkTitle}`}
            className={`absolute inset-0 w-full ${carouselHeightClass} object-contain opacity-70`}
            aria-hidden="true"
          />
        ) : (
          <div className={`absolute inset-0 flex items-center justify-center ${carouselHeightClass}`}>
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        )
      ) : null}
      
      <img
        src={optimizedUrl} 
        alt={`${artworkTitle} by ${artistName} (${index + 1} of ${totalImages})`}
        className={`w-full ${carouselHeightClass} object-contain transition-opacity duration-300`}
        style={{
          opacity: isLoading ? 0 : 1
        }}
        onLoad={() => {
          if (mountedRef.current) {
            logger.debug(`CarouselImage: Image loaded: ${optimizedUrl} (index ${index})`);
            setIsLoading(false);
            if (optimizedUrl !== "/placeholder.svg") {
                 cacheImageIfNeeded();
            }
          }
        }}
        onError={() => {
          if (mountedRef.current) {
            logger.warn(`CarouselImage: Error loading image: ${optimizedUrl} (index ${index}). Falling back to placeholder.`);
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
