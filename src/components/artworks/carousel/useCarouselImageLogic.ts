
import { useState, useEffect, useRef, useCallback } from "react";
import { useImageCache } from "@/hooks/use-image-cache";
import { useEnhancedImageProcessing } from "@/hooks/use-enhanced-image-processing";
import { logger } from "@/lib/logger";

interface UseCarouselImageLogicProps {
  imageUrl: string;
  imageId?: string;
}

export function useCarouselImageLogic({ imageUrl, imageId }: UseCarouselImageLogicProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [finalImageUrl, setFinalImageUrl] = useState<string>("");
  const [isZoomed, setIsZoomed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { getCachedImage, setCachedImage } = useImageCache();
  const { processForGallery } = useEnhancedImageProcessing();
  const mountedRef = useRef(true);
  
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const getOptimizedImageUrl = useCallback((url: string): string => {
    if (!url || url === "/placeholder.svg") {
      return "/placeholder.svg";
    }

    // If already a Cloudinary URL, use it as-is or with minimal optimization
    if (url.includes('res.cloudinary.com')) {
      return url;
    }

    // For Supabase storage URLs, create Cloudinary fetch URL
    if (url.includes('supabase.co/storage') && url.includes('/public/')) {
      const cloudinaryBaseUrl = 'https://res.cloudinary.com/dpckgjtaj/image/fetch';
      const transformations = 'w_1200,h_1200,c_limit,q_85,f_auto';
      const encodedUrl = encodeURIComponent(url);
      return `${cloudinaryBaseUrl}/${transformations}/${encodedUrl}`;
    }

    return url;
  }, []);
  
  // Process image when imageUrl or imageId changes
  useEffect(() => {
    if (!mountedRef.current || !imageUrl) return;

    const processImage = async () => {
      setIsProcessing(true);
      setIsLoading(true);
      setHasError(false);
      
      try {
        // Check cache first
        const cached = getCachedImage(imageUrl);
        if (cached && mountedRef.current) {
          setFinalImageUrl(cached.dataUrl);
          setIsLoading(false);
          setIsProcessing(false);
          return;
        }

        // Get optimized URL
        let optimizedUrl = getOptimizedImageUrl(imageUrl);
        
        // If we have an imageId and it's not a placeholder, try Cloudinary processing
        if (imageId && imageId !== "placeholder" && !imageUrl.includes('res.cloudinary.com')) {
          try {
            logger.log(`Attempting Cloudinary processing for image: ${imageId}`);
            const result = await processForGallery(imageUrl, imageId);
            
            if (result.success && result.processed_url && mountedRef.current) {
              optimizedUrl = result.processed_url;
              logger.log(`Cloudinary processing successful: ${imageId}`);
            }
          } catch (cloudinaryError) {
            logger.warn(`Cloudinary processing failed for ${imageId}, using optimized URL:`, cloudinaryError);
          }
        }
        
        if (mountedRef.current) {
          setFinalImageUrl(optimizedUrl);
        }
      } catch (error) {
        logger.error(`Failed to process image: ${imageId || 'no-id'}`, error);
        if (mountedRef.current) {
          setFinalImageUrl(getOptimizedImageUrl(imageUrl));
        }
      } finally {
        if (mountedRef.current) {
          setIsProcessing(false);
        }
      }
    };

    processImage();
    
  }, [imageUrl, imageId, processForGallery, getOptimizedImageUrl, getCachedImage]);
  
  const handleImageLoad = useCallback(() => {
    if (!mountedRef.current) return;
    
    logger.log(`Image loaded successfully: ${finalImageUrl}`);
    setIsLoading(false);
    setHasError(false);
    
    // Cache the successfully loaded image
    if (finalImageUrl && finalImageUrl !== "/placeholder.svg" && imageUrl) {
      try {
        setCachedImage(imageUrl, finalImageUrl, 'medium');
      } catch (error) {
        logger.warn("Failed to cache image:", error);
      }
    }
  }, [finalImageUrl, setCachedImage, imageUrl]);

  const handleImageError = useCallback(() => {
    if (!mountedRef.current) return;
    
    logger.warn(`Failed to load image: ${finalImageUrl}`);
    setIsLoading(false);
    setHasError(true);
    
    // Fallback to placeholder
    setFinalImageUrl("/placeholder.svg");
  }, [finalImageUrl]);

  const toggleZoom = useCallback(() => {
    setIsZoomed(!isZoomed);
  }, [isZoomed]);

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleZoom();
  }, [toggleZoom]);

  // Show placeholder if error or no valid URL
  const displayUrl = hasError || !finalImageUrl ? "/placeholder.svg" : finalImageUrl;

  return {
    isLoading,
    hasError,
    finalImageUrl,
    isZoomed,
    isProcessing,
    displayUrl,
    handleImageLoad,
    handleImageError,
    handleImageClick,
    toggleZoom,
  };
}
