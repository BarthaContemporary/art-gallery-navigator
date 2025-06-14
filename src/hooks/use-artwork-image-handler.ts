
import { useState, useEffect, useCallback, useRef } from 'react';
import { useImageCache } from '@/hooks/use-image-cache';
import { logger } from '@/lib/logger';

interface UseArtworkImageHandlerProps {
  // This will be the primary Cloudinary URL to display (e.g., medium_url or thumbnail_url)
  displayImageUrl: string | null; 
  // A stable identifier for the image, e.g., artwork_images.id or the original Supabase URL.
  // This is used as the primary key for caching, as displayImageUrl (Cloudinary URL) might change if reprocessed.
  cacheKey: string | null; 
  // Indicates the type/size category of displayImageUrl for appropriate caching.
  imageTypeForCache: 'thumbnail' | 'medium' | 'full'; 
  title: string;
}

export function useArtworkImageHandler({ 
  displayImageUrl, 
  cacheKey,
  imageTypeForCache,
  title 
}: UseArtworkImageHandlerProps) {
  const [determinedOptimizedUrl, setDeterminedOptimizedUrl] = useState<string>("/placeholder.svg");
  const [initialCachedPreviewUrl, setInitialCachedPreviewUrl] = useState<string | null>(null);
  const { getCachedImage, setCachedImage } = useImageCache();
  const imageLoadAttemptedRef = useRef(false); // To prevent multiple cache attempts for the same load

  useEffect(() => {
    imageLoadAttemptedRef.current = false; // Reset on prop change

    if (!displayImageUrl || !cacheKey) {
      logger.debug(`useArtworkImageHandler (${title}): No displayImageUrl or cacheKey, using placeholder.`);
      setDeterminedOptimizedUrl("/placeholder.svg");
      setInitialCachedPreviewUrl(null);
      return;
    }

    // Skip caching for placeholder images
    if (displayImageUrl === "/placeholder.svg") {
      setDeterminedOptimizedUrl("/placeholder.svg");
      setInitialCachedPreviewUrl(null);
      return;
    }

    // Try to get from cache first
    const cachedImage = getCachedImage(cacheKey, imageTypeForCache);
    if (cachedImage) {
      logger.debug(`useArtworkImageHandler (${title}): Found cached ${imageTypeForCache} for key ${cacheKey}. Displaying cached.`);
      setInitialCachedPreviewUrl(cachedImage.dataUrl); // Show cached version immediately
      setDeterminedOptimizedUrl(cachedImage.dataUrl); // Use cached version as the one to display
    } else {
      logger.debug(`useArtworkImageHandler (${title}): No cached ${imageTypeForCache} for key ${cacheKey}. Will load: ${displayImageUrl}`);
      setInitialCachedPreviewUrl(null); // No preview available initially
      setDeterminedOptimizedUrl(displayImageUrl); // Set to the actual Cloudinary URL to load
    }

  }, [displayImageUrl, cacheKey, imageTypeForCache, title, getCachedImage]);

  const cacheLoadedImage = useCallback((loadedSrc: string) => {
    // Only cache if the loaded source is not the placeholder and we have a valid cacheKey,
    // and it's the actual network URL (not a data: URL from cache itself), and not yet attempted.
    if (!cacheKey || loadedSrc === "/placeholder.svg" || loadedSrc.startsWith("data:") || imageLoadAttemptedRef.current) {
      return;
    }
    imageLoadAttemptedRef.current = true;
    
    logger.debug(`useArtworkImageHandler (${title}): Attempting to cache ${imageTypeForCache} from loaded source. Key: ${cacheKey}, Source: ${loadedSrc}`);

    try {
      const img = new Image();
      img.crossOrigin = "anonymous"; // Important for Cloudinary images if drawing to canvas
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            logger.error(`useArtworkImageHandler (${title}): Failed to get canvas context for caching.`);
            return;
          }

          // Optimize canvas size based on tier to reduce memory usage
          let maxDimension = 800; // Default for thumbnail
          if (imageTypeForCache === 'medium') maxDimension = 1200;
          if (imageTypeForCache === 'full') maxDimension = 1600; // Reduced from original size
          
          const scale = Math.min(maxDimension / Math.max(img.naturalWidth, img.naturalHeight), 1);
          canvas.width = Math.floor(img.naturalWidth * scale);
          canvas.height = Math.floor(img.naturalHeight * scale);
          
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Use lower quality for better compression
          const quality = imageTypeForCache === 'thumbnail' ? 0.7 : 0.8;
          const dataUrl = canvas.toDataURL("image/webp", quality);
          
          // Only cache if the result is reasonable size
          if (dataUrl.length < 5 * 1024 * 1024) { // 5MB limit
            setCachedImage(cacheKey, dataUrl, imageTypeForCache);
            logger.log(`useArtworkImageHandler (${title}): Cached ${imageTypeForCache} image for key ${cacheKey}. DataURL size: ${dataUrl.length}`);
          } else {
            logger.warn(`useArtworkImageHandler (${title}): Skipped caching - result too large: ${dataUrl.length} bytes`);
          }
        } catch (canvasError) {
          logger.error(`useArtworkImageHandler (${title}): Canvas processing failed:`, canvasError);
        }
      };
      img.onerror = () => {
        logger.error(`useArtworkImageHandler (${title}): Failed to load image for caching: ${loadedSrc}`);
      };
      img.src = loadedSrc; // Start loading the image to draw on canvas
    } catch (error) {
      logger.error(`useArtworkImageHandler (${title}): Failed to cache image for key ${cacheKey}:`, error);
    }
  }, [cacheKey, imageTypeForCache, title, setCachedImage]);

  return {
    determinedOptimizedUrl, // This is the URL (cached or network) the <img> should use
    initialCachedPreviewUrl,  // This is a dataURL if a cached version was found for immediate paint
    cacheLoadedImage,       // Call this in onLoad of the <img> tag
  };
}
