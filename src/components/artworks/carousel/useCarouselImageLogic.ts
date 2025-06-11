
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
  const processingTimeoutRef = useRef<NodeJS.Timeout>();
  
  useEffect(() => {
    mountedRef.current = true;
    return () => { 
      mountedRef.current = false;
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);

  const getOptimizedImageUrl = useCallback((url: string): string => {
    if (!url || url === "/placeholder.svg") {
      return "/placeholder.svg";
    }

    // If already a proper Cloudinary URL, use it as-is
    if (url.includes('res.cloudinary.com')) {
      logger.log(`Using existing Cloudinary URL: ${url}`);
      return url;
    }

    // For any non-Cloudinary URLs (including Supabase storage), create Cloudinary fetch URL
    const cloudinaryBaseUrl = 'https://res.cloudinary.com/dpckgjtaj/image/fetch';
    const transformations = 'w_1200,h_1200,c_limit,q_85,f_auto';
    const encodedUrl = encodeURIComponent(url);
    const cloudinaryUrl = `${cloudinaryBaseUrl}/${transformations}/${encodedUrl}`;
    logger.log(`Created Cloudinary URL from ${url} -> ${cloudinaryUrl}`);
    return cloudinaryUrl;
  }, []);

  const clearProcessingTimeout = useCallback(() => {
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = undefined;
    }
  }, []);

  const setProcessingWithTimeout = useCallback((processing: boolean) => {
    setIsProcessing(processing);
    
    if (processing) {
      // Set a 10-second timeout for processing
      processingTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          logger.warn(`Processing timeout for image: ${imageId || 'no-id'}`);
          setIsProcessing(false);
          // Fall back to optimized URL if processing times out
          if (imageUrl) {
            setFinalImageUrl(getOptimizedImageUrl(imageUrl));
          }
        }
      }, 10000);
    } else {
      clearProcessingTimeout();
    }
  }, [imageId, imageUrl, getOptimizedImageUrl, clearProcessingTimeout]);
  
  // Process image when imageUrl or imageId changes
  useEffect(() => {
    if (!mountedRef.current || !imageUrl) return;

    const processImage = async () => {
      setProcessingWithTimeout(true);
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
          setProcessingWithTimeout(false);
          return;
        }

        // Start with optimized URL as fallback
        let finalUrl = getOptimizedImageUrl(imageUrl);
        
        // Try Cloudinary processing if we have a valid imageId
        if (imageId && imageId !== "placeholder") {
          try {
            logger.log(`Attempting Cloudinary processing for image: ${imageId}`);
            const result = await processForGallery(imageUrl, imageId);
            
            if (result.success && result.processed_url && mountedRef.current) {
              // Use the processed URL from Cloudinary
              if (result.processed_url.includes('res.cloudinary.com')) {
                finalUrl = result.processed_url;
                logger.log(`Cloudinary processing successful: ${imageId}, URL: ${finalUrl}`);
              } else {
                logger.warn(`Cloudinary processing completed but URL not recognized as Cloudinary: ${result.processed_url}`);
              }
            } else {
              logger.warn(`Cloudinary processing failed for ${imageId}, using optimized URL`);
            }
          } catch (cloudinaryError) {
            logger.warn(`Cloudinary processing failed for ${imageId}, using optimized URL:`, cloudinaryError);
            // Don't throw here, just use the fallback URL
          }
        }
        
        if (mountedRef.current) {
          logger.log(`Setting final image URL: ${finalUrl}`);
          setFinalImageUrl(finalUrl);
        }
      } catch (error) {
        logger.error(`Failed to process image: ${imageId || 'no-id'}`, error);
        if (mountedRef.current) {
          // Even on error, try to show the optimized URL
          setFinalImageUrl(getOptimizedImageUrl(imageUrl));
        }
      } finally {
        if (mountedRef.current) {
          setProcessingWithTimeout(false);
        }
      }
    };

    processImage();
    
    // Cleanup timeout on unmount or re-run
    return () => {
      clearProcessingTimeout();
    };
  }, [imageUrl, imageId, processForGallery, getOptimizedImageUrl, getCachedImage, setProcessingWithTimeout, clearProcessingTimeout]);
  
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
    
    // Try fallback to original URL if current URL failed
    if (finalImageUrl !== imageUrl && imageUrl) {
      logger.log(`Trying fallback to original URL: ${imageUrl}`);
      setFinalImageUrl(imageUrl);
      setHasError(false);
    } else {
      // Final fallback to placeholder
      setFinalImageUrl("/placeholder.svg");
    }
  }, [finalImageUrl, imageUrl]);

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
