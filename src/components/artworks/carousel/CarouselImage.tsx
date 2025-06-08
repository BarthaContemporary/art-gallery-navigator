
import { useState, useEffect, useRef, memo, useCallback } from "react";
import { useImageCache } from "@/hooks/use-image-cache";
import { useEnhancedImageProcessing } from "@/hooks/use-enhanced-image-processing";
import { logger } from "@/lib/logger";
import { Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CarouselImageProps {
  imageUrl: string;
  imageId?: string;
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
  imageId,
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
  const [processedUrl, setProcessedUrl] = useState<string>("");
  const [isZoomed, setIsZoomed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [placeholderUrl, setPlaceholderUrl] = useState<string | null>(null);
  
  const { getCachedImage, setCachedImage } = useImageCache();
  const { processForGallery } = useEnhancedImageProcessing();
  const mountedRef = useRef(true);
  const imageRef = useRef<HTMLImageElement>(null);
  
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  
  const getOptimizedImageUrl = useCallback((url: string): string => {
    if (!url || url === "/placeholder.svg") {
      return "/placeholder.svg";
    }

    // If already a Cloudinary URL, use it with zoom-optimized settings
    if (url.includes('res.cloudinary.com')) {
      try {
        const urlParts = url.split('/upload/');
        if (urlParts.length === 2 && urlParts[1] && urlParts[1] !== 'undefined') {
          const baseUrl = urlParts[0];
          const imagePath = urlParts[1];
          // Higher quality for zoom functionality
          return `${baseUrl}/upload/w_2400,h_1800,c_limit,q_95,f_webp/${imagePath}`;
        }
      } catch (error) {
        logger.warn(`Failed to optimize Cloudinary URL: ${url}`, error);
      }
    }

    // For Supabase storage URLs
    if (url.includes('supabase.co/storage') && url.includes('/public/')) {
      const transformParams = "w=2400&h=1800&resize=contain&q=95&f=auto";
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}transform=${transformParams}`;
    }

    return url;
  }, []);

  // Process image through Cloudinary if we have an imageId
  useEffect(() => {
    if (!mountedRef.current || !imageUrl || !imageId) return;

    const processImage = async () => {
      setIsProcessing(true);
      
      try {
        const result = await processForGallery(imageUrl, imageId);
        
        if (result.success && result.processed_url && mountedRef.current) {
          setProcessedUrl(result.processed_url);
          logger.log(`Successfully processed image through Cloudinary: ${imageId}`);
        } else {
          setProcessedUrl(getOptimizedImageUrl(imageUrl));
        }
      } catch (error) {
        logger.error(`Failed to process image through Cloudinary: ${imageId}`, error);
        setProcessedUrl(getOptimizedImageUrl(imageUrl));
      } finally {
        if (mountedRef.current) {
          setIsProcessing(false);
        }
      }
    };

    // Check cache first
    const cachedData = getCachedImage(imageUrl);
    if (cachedData) {
      setPlaceholderUrl(cachedData.dataUrl);
    }

    // If no imageId, just use optimized URL
    if (!imageId) {
      setProcessedUrl(getOptimizedImageUrl(imageUrl));
      setIsProcessing(false);
    } else {
      processImage();
    }
    
  }, [imageUrl, imageId, getCachedImage, getOptimizedImageUrl, processForGallery]);
  
  const handleImageLoad = useCallback(() => {
    if (!mountedRef.current) return;
    
    setIsLoading(false);
    setHasError(false);
    
    // Cache the image for future use
    if (processedUrl && processedUrl !== "/placeholder.svg") {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          if (!mountedRef.current) return;
          
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          
          if (ctx && img.width > 0 && img.height > 0) {
            const maxDimension = 400;
            const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
            
            canvas.width = Math.floor(img.width * scale);
            canvas.height = Math.floor(img.height * scale);
            
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
            setCachedImage(imageUrl, dataUrl);
          }
        };
        img.src = processedUrl;
      } catch (error) {
        logger.warn("Failed to cache image:", error);
      }
    }
  }, [processedUrl, setCachedImage, imageUrl]);

  const handleImageError = useCallback(() => {
    if (!mountedRef.current) return;
    
    logger.warn(`Failed to load image: ${processedUrl}`);
    setIsLoading(false);
    setHasError(true);
  }, [processedUrl]);

  const toggleZoom = useCallback(() => {
    setIsZoomed(!isZoomed);
  }, [isZoomed]);

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    toggleZoom();
  }, [toggleZoom]);

  const displayUrl = hasError ? "/placeholder.svg" : (processedUrl || "/placeholder.svg");

  return (
    <div 
      className={`relative w-full flex-[0_0_100%] ${carouselHeightClass} group`}
      role={role}
      aria-roledescription={ariaRoledescription}
      aria-label={ariaLabel}
    >
      {/* Loading state with optional placeholder */}
      {(isLoading || isProcessing) && (
        <div className={`absolute inset-0 flex items-center justify-center ${carouselHeightClass} bg-muted/20 z-10`}>
          {placeholderUrl ? (
            <img 
              src={placeholderUrl}
              alt={`Loading preview for ${artworkTitle}`}
              className={`absolute inset-0 w-full ${carouselHeightClass} object-contain opacity-50`}
              aria-hidden="true"
            />
          ) : null}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 bg-background/80 p-4 rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {isProcessing ? "Processing with Cloudinary..." : "Loading image..."}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Zoom controls */}
      {!isLoading && !isProcessing && !hasError && (
        <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleZoom}
            className="bg-background/80 hover:bg-background/90"
          >
            {isZoomed ? (
              <>
                <ZoomOut className="h-4 w-4 mr-1" />
                Zoom Out
              </>
            ) : (
              <>
                <ZoomIn className="h-4 w-4 mr-1" />
                Zoom In
              </>
            )}
          </Button>
        </div>
      )}
      
      {/* Main image */}
      <div 
        className={`w-full ${carouselHeightClass} overflow-hidden cursor-pointer ${
          isZoomed ? 'overflow-auto' : ''
        }`}
      >
        <img
          ref={imageRef}
          src={displayUrl}
          alt={`${artworkTitle} by ${artistName} (${index + 1} of ${totalImages})`}
          className={`transition-all duration-300 ${
            isLoading || isProcessing ? 'opacity-0' : 'opacity-100'
          } ${
            isZoomed 
              ? 'w-auto h-auto min-w-full min-h-full object-contain cursor-zoom-out scale-150 origin-center' 
              : `w-full ${carouselHeightClass} object-contain cursor-zoom-in hover:scale-105`
          }`}
          onLoad={handleImageLoad}
          onError={handleImageError}
          onClick={handleImageClick}
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
});
