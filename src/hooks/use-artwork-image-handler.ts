
import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';

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
  const [isValidUrl, setIsValidUrl] = useState<boolean>(false);

  useEffect(() => {
    if (!displayImageUrl || displayImageUrl === "/placeholder.svg" || displayImageUrl.trim() === "") {
      logger.debug(`useArtworkImageHandler (${title}): No valid displayImageUrl, using placeholder.`);
      setDeterminedOptimizedUrl("/placeholder.svg");
      setIsValidUrl(false);
      return;
    }

    // Simple URL validation
    try {
      const url = new URL(displayImageUrl, window.location.origin);
      if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'data:') {
        setDeterminedOptimizedUrl(displayImageUrl);
        setIsValidUrl(true);
        logger.debug(`useArtworkImageHandler (${title}): Using URL: ${displayImageUrl}`);
      } else {
        throw new Error('Invalid protocol');
      }
    } catch (error) {
      logger.warn(`useArtworkImageHandler (${title}): Invalid URL detected:`, displayImageUrl);
      setDeterminedOptimizedUrl("/placeholder.svg");
      setIsValidUrl(false);
    }
  }, [displayImageUrl, title]);

  const cacheLoadedImage = useCallback(() => {
    // Simplified - just log for debugging
    if (isValidUrl && determinedOptimizedUrl !== "/placeholder.svg") {
      logger.log(`useArtworkImageHandler (${title}): Image loaded successfully: ${determinedOptimizedUrl}`);
    }
  }, [determinedOptimizedUrl, isValidUrl, title]);

  return {
    determinedOptimizedUrl,
    initialCachedPreviewUrl: null, // Simplified - no caching for now
    cacheLoadedImage,
  };
}
