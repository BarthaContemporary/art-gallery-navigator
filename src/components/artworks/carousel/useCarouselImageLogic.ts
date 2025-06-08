
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

    // For Supabase storage URLs, create Cloudinary fetch URL
    if (url.includes('supabase.co/storage') && url.includes('/public/')) {
      const cloudinaryBaseUrl = 'https://res.cloudinary.com/dpckgjtaj/image/fetch';
      const transformations = 'a_auto,e_sharpen,w_2400,h_2400,c_limit,q_90,f_webp';
      const encodedUrl = encodeURIComponent(url);
      return `${cloudinaryBaseUrl}/${transformations}/${encodedUrl}`;
    }

    return url;
  }, []);
  
  // Process image through Cloudinary if we have an imageId, otherwise use optimized URL
  useEffect(() => {
    if (!mountedRef.current || !imageUrl) return;

    const processImage = async () => {
      setIsProcessing(true);
      setIsLoading(true);
      setHasError(false);
      
      try {
        // Always try to get an optimized URL first
        const optimizedUrl = getOptimizedImageUrl(imageUrl);
        
        // If we have an imageId, try to process through Cloudinary for better quality
        if (imageId && imageId !== "placeholder") {
          logger.log(`Attempting to process image ${imageId} through Cloudinary`);
          
          try {
            const result = await processForGallery(imageUrl, imageId);
            
            if (result.success && result.processed_url && mountedRef.current) {
              setFinalImageUrl(result.processed_url);
              logger.log(`Successfully processed image through Cloudinary: ${imageId}`);
            } else {
              // Fallback to optimized URL if Cloudinary processing fails
              logger.log(`Cloudinary processing failed for ${imageId}, using optimized URL`);
              setFinalImageUrl(optimizedUrl);
            }
          } catch (cloudinaryError) {
            // If Cloudinary fails, use the optimized URL
            logger.warn(`Cloudinary processing error for ${imageId}, falling back to optimized URL:`, cloudinaryError);
            setFinalImageUrl(optimizedUrl);
          }
        } else {
          // No imageId, use optimized URL directly
          setFinalImageUrl(optimizedUrl);
        }
      } catch (error) {
        logger.error(`Failed to process image: ${imageId || 'no-id'}`, error);
        // Final fallback to original URL
        setFinalImageUrl(imageUrl);
      } finally {
        if (mountedRef.current) {
          setIsProcessing(false);
        }
      }
    };

    processImage();
    
  }, [imageUrl, imageId, processForGallery, getOptimizedImageUrl]);
  
  const handleImageLoad = useCallback(() => {
    if (!mountedRef.current) return;
    
    logger.log(`Image loaded successfully: ${finalImageUrl}`);
    setIsLoading(false);
    setHasError(false);
    
    // Cache the image for future use
    if (finalImageUrl && finalImageUrl !== "/placeholder.svg") {
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
        img.src = finalImageUrl;
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
  }, [finalImageUrl]);

  const toggleZoom = useCallback(() => {
    setIsZoomed(!isZoomed);
  }, [isZoomed]);

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
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
