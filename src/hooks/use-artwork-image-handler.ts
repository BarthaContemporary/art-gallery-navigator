
import { useState, useEffect, useCallback, useRef } from 'react';
import { useImageCache } from '@/hooks/use-image-cache';
import { logger } from '@/lib/logger';
import { validateImageUrl, getOptimizedImageUrl } from '@/hooks/use-optimized-image/url-generator';

interface UseArtworkImageHandlerProps {
  displayImageUrl: string | null; 
  cacheKey: string | null; 
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
  const imageLoadAttemptedRef = useRef(false);

  useEffect(() => {
    imageLoadAttemptedRef.current = false;

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

    // Validate URL before proceeding
    if (!validateImageUrl(displayImageUrl)) {
      logger.warn(`useArtworkImageHandler (${title}): Invalid URL detected:`, displayImageUrl);
      setDeterminedOptimizedUrl("/placeholder.svg");
      setInitialCachedPreviewUrl(null);
      return;
    }

    // Get optimized URL using the improved URL generator
    const optimizedUrl = getOptimizedImageUrl(displayImageUrl, imageTypeForCache);
    
    logger.debug(`useArtworkImageHandler (${title}): Processing URL:`, {
      original: displayImageUrl,
      optimized: optimizedUrl,
      cacheKey,
      imageTypeForCache
    });

    // Try to get from cache first
    const cachedImage = getCachedImage(cacheKey, imageTypeForCache);
    if (cachedImage) {
      logger.debug(`useArtworkImageHandler (${title}): Found cached ${imageTypeForCache} for key ${cacheKey}.`);
      setInitialCachedPreviewUrl(cachedImage.dataUrl);
      setDeterminedOptimizedUrl(cachedImage.dataUrl);
    } else {
      logger.debug(`useArtworkImageHandler (${title}): No cached ${imageTypeForCache} for key ${cacheKey}. Will load: ${optimizedUrl}`);
      setInitialCachedPreviewUrl(null);
      setDeterminedOptimizedUrl(optimizedUrl);
    }

  }, [displayImageUrl, cacheKey, imageTypeForCache, title, getCachedImage]);

  const cacheLoadedImage = useCallback((loadedSrc: string) => {
    if (!cacheKey || loadedSrc === "/placeholder.svg" || loadedSrc.startsWith("data:") || imageLoadAttemptedRef.current) {
      return;
    }
    imageLoadAttemptedRef.current = true;
    
    logger.debug(`useArtworkImageHandler (${title}): Attempting to cache ${imageTypeForCache} from loaded source. Key: ${cacheKey}, Source: ${loadedSrc}`);

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            logger.error(`useArtworkImageHandler (${title}): Failed to get canvas context for caching.`);
            return;
          }

          // Optimize canvas size based on tier
          let maxDimension = 800;
          if (imageTypeForCache === 'medium') maxDimension = 1200;
          if (imageTypeForCache === 'full') maxDimension = 1600;
          
          const scale = Math.min(maxDimension / Math.max(img.naturalWidth, img.naturalHeight), 1);
          canvas.width = Math.floor(img.naturalWidth * scale);
          canvas.height = Math.floor(img.naturalHeight * scale);
          
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          const quality = imageTypeForCache === 'thumbnail' ? 0.7 : 0.8;
          const dataUrl = canvas.toDataURL("image/webp", quality);
          
          if (dataUrl.length < 5 * 1024 * 1024) {
            setCachedImage(cacheKey, dataUrl, imageTypeForCache);
            logger.log(`useArtworkImageHandler (${title}): Successfully cached ${imageTypeForCache} image for key ${cacheKey}. DataURL size: ${Math.round(dataUrl.length / 1024)}KB`);
          } else {
            logger.warn(`useArtworkImageHandler (${title}): Skipped caching - result too large: ${Math.round(dataUrl.length / 1024 / 1024)}MB`);
          }
        } catch (canvasError) {
          logger.error(`useArtworkImageHandler (${title}): Canvas processing failed:`, canvasError);
        }
      };
      img.onerror = () => {
        logger.error(`useArtworkImageHandler (${title}): Failed to load image for caching: ${loadedSrc}`);
      };
      img.src = loadedSrc;
    } catch (error) {
      logger.error(`useArtworkImageHandler (${title}): Failed to cache image for key ${cacheKey}:`, error);
    }
  }, [cacheKey, imageTypeForCache, title, setCachedImage]);

  return {
    determinedOptimizedUrl,
    initialCachedPreviewUrl,
    cacheLoadedImage,
  };
}
