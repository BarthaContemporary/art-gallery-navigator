
import { useState, useEffect, useRef, useCallback } from "react";
import { useImageCache } from "@/hooks/use-image-cache";
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
  
  const { getCachedImage, setCachedImage } = useImageCache();
  const mountedRef = useRef(true);
  const imageLoadTimeoutRef = useRef<NodeJS.Timeout>();
  
  useEffect(() => {
    mountedRef.current = true;
    return () => { 
      mountedRef.current = false;
      if (imageLoadTimeoutRef.current) {
        clearTimeout(imageLoadTimeoutRef.current);
      }
    };
  }, []);

  const createOptimizedUrl = useCallback((url: string): string => {
    if (!url || url === "/placeholder.svg") {
      return "/placeholder.svg";
    }

    // If it's already a Cloudinary URL, use it as-is
    if (url.includes('res.cloudinary.com')) {
      return url;
    }

    // Create a simple Cloudinary transformation URL for better performance
    const cloudinaryBaseUrl = 'https://res.cloudinary.com/dpckgjtaj/image/fetch';
    const transformations = 'w_1200,h_1200,c_limit,q_85,f_auto';
    const encodedUrl = encodeURIComponent(url);
    return `${cloudinaryBaseUrl}/${transformations}/${encodedUrl}`;
  }, []);

  const clearImageTimeout = useCallback(() => {
    if (imageLoadTimeoutRef.current) {
      clearTimeout(imageLoadTimeoutRef.current);
      imageLoadTimeoutRef.current = undefined;
    }
  }, []);

  // Main image processing effect
  useEffect(() => {
    if (!mountedRef.current || !imageUrl) {
      setFinalImageUrl("/placeholder.svg");
      setIsLoading(false);
      return;
    }

    const processImage = async () => {
      logger.log(`Loading image: ${imageUrl} (ID: ${imageId || 'no-id'})`);
      
      setIsLoading(true);
      setHasError(false);
      clearImageTimeout();
      
      try {
        // Check cache first
        const cached = getCachedImage(imageUrl);
        if (cached && mountedRef.current) {
          logger.log(`Using cached image for: ${imageUrl}`);
          setFinalImageUrl(cached.dataUrl);
          setIsLoading(false);
          return;
        }

        // Set a 8-second timeout for image loading
        imageLoadTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            logger.warn(`Image loading timeout for: ${imageId || 'no-id'}`);
            setFinalImageUrl("/placeholder.svg");
            setIsLoading(false);
            setHasError(true);
          }
        }, 8000);

        // Try optimized URL first, then fallback to original
        let urlToUse = createOptimizedUrl(imageUrl);
        
        if (mountedRef.current) {
          logger.log(`Setting image URL to: ${urlToUse}`);
          setFinalImageUrl(urlToUse);
        }
      } catch (error) {
        logger.error(`Failed to process image: ${imageId || 'no-id'}`, error);
        if (mountedRef.current) {
          // Fallback to original URL on any error
          setFinalImageUrl(imageUrl);
        }
      }
    };

    processImage();
    
    return () => {
      clearImageTimeout();
    };
  }, [imageUrl, imageId, getCachedImage, createOptimizedUrl, clearImageTimeout]);
  
  const handleImageLoad = useCallback(() => {
    if (!mountedRef.current) return;
    
    logger.log(`Image loaded successfully: ${finalImageUrl}`);
    clearImageTimeout();
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
  }, [finalImageUrl, setCachedImage, imageUrl, clearImageTimeout]);

  const handleImageError = useCallback(() => {
    if (!mountedRef.current) return;
    
    logger.warn(`Failed to load image: ${finalImageUrl}`);
    clearImageTimeout();
    
    // If the optimized URL failed, try the original URL
    if (finalImageUrl !== imageUrl && imageUrl && !imageUrl.includes('placeholder')) {
      logger.log(`Trying fallback to original URL: ${imageUrl}`);
      setFinalImageUrl(imageUrl);
      setHasError(false);
      // Don't set loading to false yet, let the fallback image load
    } else {
      // Final fallback to placeholder
      logger.log(`Using placeholder image`);
      setFinalImageUrl("/placeholder.svg");
      setIsLoading(false);
      setHasError(true);
    }
  }, [finalImageUrl, imageUrl, clearImageTimeout]);

  const toggleZoom = useCallback(() => {
    setIsZoomed(!isZoomed);
  }, [isZoomed]);

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleZoom();
  }, [toggleZoom]);

  // Use the final image URL or fallback to placeholder
  const displayUrl = finalImageUrl || "/placeholder.svg";

  return {
    isLoading,
    hasError,
    finalImageUrl,
    isZoomed,
    isProcessing: false, // Simplified - no complex processing states
    displayUrl,
    handleImageLoad,
    handleImageError,
    handleImageClick,
    toggleZoom,
  };
}
