
import { useState, useEffect, useRef, memo, useCallback } from "react";
import { useImageCache } from "@/hooks/use-image-cache";
import { logger } from "@/lib/logger";
import { Loader2 } from "lucide-react";

interface CarouselImageProps {
  imageUrl: string;
  index: number;
  totalImages: number;
  artistName?: string;
  artworkTitle?: string;
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
  const [hasError, setHasError] = useState(false);
  const [optimizedUrl, setOptimizedUrl] = useState<string>("");
  const [placeholderUrl, setPlaceholderUrl] = useState<string | null>(null);
  const { getCachedImage, setCachedImage } = useImageCache();
  const mountedRef = useRef(true);
  const imageProcessedRef = useRef(false);
  
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  
  const getOptimizedImageUrl = useCallback((url: string): string => {
    if (!url || url === "/placeholder.svg") {
      return "/placeholder.svg";
    }

    // If already a Cloudinary URL, use it with optimizations
    if (url.includes('res.cloudinary.com')) {
      try {
        const urlParts = url.split('/upload/');
        if (urlParts.length === 2 && urlParts[1] && urlParts[1] !== 'undefined') {
          const baseUrl = urlParts[0];
          const imagePath = urlParts[1];
          return `${baseUrl}/upload/w_1920,h_1080,c_limit,q_90,f_webp/${imagePath}`;
        }
      } catch (error) {
        logger.warn(`Failed to optimize Cloudinary URL: ${url}`, error);
      }
    }

    // For Supabase storage URLs
    if (url.includes('supabase.co/storage') && url.includes('/public/')) {
      const transformParams = "w=1920&h=1080&resize=contain&q=90&f=auto";
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}transform=${transformParams}`;
    }

    return url;
  }, []);
  
  // Initialize image processing only once
  useEffect(() => {
    if (!mountedRef.current || !imageUrl || imageProcessedRef.current) return;

    imageProcessedRef.current = true;
    setIsLoading(true);
    setHasError(false);
    
    // Check cache first
    const cachedData = getCachedImage(imageUrl);
    if (cachedData) {
      setPlaceholderUrl(cachedData.dataUrl);
    } else {
      setPlaceholderUrl(null);
    }
    
    const optimized = getOptimizedImageUrl(imageUrl);
    setOptimizedUrl(optimized);
    
  }, [imageUrl, getCachedImage, getOptimizedImageUrl]);
  
  const handleImageLoad = useCallback(() => {
    if (!mountedRef.current) return;
    
    setIsLoading(false);
    setHasError(false);
    
    // Cache the image for future use (simplified)
    if (optimizedUrl && optimizedUrl !== "/placeholder.svg") {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          if (!mountedRef.current) return;
          
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          
          if (ctx && img.width > 0 && img.height > 0) {
            const maxDimension = 300;
            const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
            
            canvas.width = Math.floor(img.width * scale);
            canvas.height = Math.floor(img.height * scale);
            
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
            setCachedImage(imageUrl, dataUrl);
          }
        };
        img.src = optimizedUrl;
      } catch (error) {
        logger.warn("Failed to cache image:", error);
      }
    }
  }, [optimizedUrl, setCachedImage, imageUrl]);

  const handleImageError = useCallback(() => {
    if (!mountedRef.current) return;
    
    logger.warn(`Failed to load image: ${optimizedUrl}`);
    setIsLoading(false);
    setHasError(true);
  }, [optimizedUrl]);

  const displayUrl = hasError ? "/placeholder.svg" : (optimizedUrl || "/placeholder.svg");

  return (
    <div 
      className={`relative w-full flex-[0_0_100%] ${carouselHeightClass}`}
      role={role}
      aria-roledescription={ariaRoledescription}
      aria-label={ariaLabel}
    >
      {/* Loading state with optional placeholder */}
      {isLoading && (
        <div className={`absolute inset-0 flex items-center justify-center ${carouselHeightClass} bg-muted/20`}>
          {placeholderUrl ? (
            <img 
              src={placeholderUrl}
              alt={`Loading preview for ${artworkTitle}`}
              className={`absolute inset-0 w-full ${carouselHeightClass} object-contain opacity-50`}
              aria-hidden="true"
            />
          ) : (
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          )}
        </div>
      )}
      
      {/* Main image */}
      <img
        src={displayUrl}
        alt={`${artworkTitle} by ${artistName} (${index + 1} of ${totalImages})`}
        className={`w-full ${carouselHeightClass} object-contain transition-opacity duration-300`}
        style={{
          opacity: isLoading ? 0 : 1
        }}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
});
