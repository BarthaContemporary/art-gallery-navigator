
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

    // If already a proper Cloudinary URL, use it as-is
    if (url.includes('res.cloudinary.com')) {
      return url;
    }

    // For Supabase storage URLs, create Cloudinary fetch URL
    if (url.includes('supabase.co/storage') && url.includes('/public/')) {
      const cloudinaryBaseUrl = 'https://res.cloudinary.com/dpckgjtaj/image/fetch';
      const transformations = 'w_1200,h_1200,c_limit,q_85,f_auto';
      const encodedUrl = encodeURIComponent(url);
      const cloudinaryUrl = `${cloudinaryBaseUrl}/${transformations}/${encodedUrl}`;
      logger.log(`Created Cloudinary URL: ${cloudinaryUrl}`);
      return cloudinaryUrl;
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
        logger.log(`Processing image: ${imageUrl} with ID: ${imageId}`);
        
        // Check cache first
        const cached = getCachedImage(imageUrl);
        if (cached && mountedRef.current) {
          logger.log(`Found cached image for: ${imageUrl}`);
          setFinalImageUrl(cached.dataUrl);
          setIsLoading(false);
          setIsProcessing(false);
          return;
        }

        // Start with optimized URL
        let optimizedUrl = getOptimizedImageUrl(imageUrl);
        
        // Only try Cloudinary processing if we have a valid imageId and it's not already a Cloudinary URL
        if (imageId && 
            imageId !== "placeholder" && 
            !imageUrl.includes('res.cloudinary.com') &&
            imageUrl.includes('supabase.co/storage')) {
          try {
            logger.log(`Attempting Cloudinary processing for image: ${imageId}`);
            const result = await processForGallery(imageUrl, imageId);
            
            if (result.success && result.processed_url && mountedRef.current) {
              // Only use the processed URL if it's actually different and a proper Cloudinary URL
              if (result.processed_url !== imageUrl && result.processed_url.includes('res.cloudinary.com')) {
                optimizedUrl = result.processed_url;
                logger.log(`Cloudinary processing successful: ${imageId}, URL: ${optimizedUrl}`);
              } else {
                logger.warn(`Cloudinary returned original URL, using optimized URL instead`);
              }
            }
          } catch (cloudinaryError) {
            logger.warn(`Cloudinary processing failed for ${imageId}, using optimized URL:`, cloudinaryError);
          }
        }
        
        if (mountedRef.current) {
          logger.log(`Setting final image URL: ${optimizedUrl}`);
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
