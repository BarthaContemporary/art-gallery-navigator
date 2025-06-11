
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
  const [currentAttempt, setCurrentAttempt] = useState(0);
  
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

  // Simple URL creation without complex processing
  const getImageUrls = useCallback((url: string): string[] => {
    if (!url || url === "/placeholder.svg") {
      return ["/placeholder.svg"];
    }

    // If it's already a Cloudinary URL, use it as-is
    if (url.includes('res.cloudinary.com')) {
      return [url, "/placeholder.svg"];
    }

    // Try original URL first, then simple Cloudinary optimization, then placeholder
    const cloudinaryUrl = `https://res.cloudinary.com/dpckgjtaj/image/fetch/w_1200,h_1200,c_limit,q_85,f_auto/${encodeURIComponent(url)}`;
    
    return [url, cloudinaryUrl, "/placeholder.svg"];
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
      logger.log(`Starting image load for: ${imageUrl} (ID: ${imageId || 'no-id'})`);
      
      setIsLoading(true);
      setHasError(false);
      setCurrentAttempt(0);
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

        // Get all possible URLs to try
        const urlsToTry = getImageUrls(imageUrl);
        
        // Start with the first URL
        if (mountedRef.current && urlsToTry.length > 0) {
          setFinalImageUrl(urlsToTry[0]);
          setCurrentAttempt(0);
          
          // Set a timeout to try the next URL if this one fails
          imageLoadTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current && currentAttempt < urlsToTry.length - 1) {
              logger.warn(`Image timeout, trying next URL for: ${imageId || 'no-id'}`);
              setCurrentAttempt(prev => prev + 1);
            }
          }, 5000);
        }
      } catch (error) {
        logger.error(`Failed to process image: ${imageId || 'no-id'}`, error);
        if (mountedRef.current) {
          setFinalImageUrl("/placeholder.svg");
          setIsLoading(false);
          setHasError(true);
        }
      }
    };

    processImage();
    
    return () => {
      clearImageTimeout();
    };
  }, [imageUrl, imageId, getCachedImage, getImageUrls, clearImageTimeout, currentAttempt]);

  // Handle URL changes based on attempt
  useEffect(() => {
    if (!imageUrl || !mountedRef.current) return;
    
    const urlsToTry = getImageUrls(imageUrl);
    if (currentAttempt < urlsToTry.length) {
      const urlToUse = urlsToTry[currentAttempt];
      logger.log(`Attempt ${currentAttempt + 1}: Setting image URL to: ${urlToUse}`);
      setFinalImageUrl(urlToUse);
    }
  }, [currentAttempt, imageUrl, getImageUrls]);
  
  const handleImageLoad = useCallback(() => {
    if (!mountedRef.current) return;
    
    logger.log(`Image loaded successfully: ${finalImageUrl}`);
    clearImageTimeout();
    setIsLoading(false);
    setHasError(false);
    
    // Cache the successfully loaded image if it's not a placeholder
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
    
    logger.warn(`Failed to load image attempt ${currentAttempt + 1}: ${finalImageUrl}`);
    clearImageTimeout();
    
    const urlsToTry = getImageUrls(imageUrl);
    
    // Try next URL if available
    if (currentAttempt < urlsToTry.length - 1) {
      logger.log(`Trying next URL for: ${imageId || 'no-id'}`);
      setCurrentAttempt(prev => prev + 1);
    } else {
      // All URLs failed, use placeholder
      logger.log(`All URLs failed, using placeholder for: ${imageId || 'no-id'}`);
      setFinalImageUrl("/placeholder.svg");
      setIsLoading(false);
      setHasError(true);
    }
  }, [finalImageUrl, imageUrl, currentAttempt, imageId, clearImageTimeout, getImageUrls]);

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
    isProcessing: false,
    displayUrl,
    handleImageLoad,
    handleImageError,
    handleImageClick,
    toggleZoom,
  };
}
