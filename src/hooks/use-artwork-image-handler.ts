
import { useState, useEffect } from 'react';
import { validateImageUrl } from '@/utils/image-url-utils';
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
    if (!displayImageUrl) {
      logger.debug(`useArtworkImageHandler (${title}): No displayImageUrl provided`);
      setDeterminedOptimizedUrl("/placeholder.svg");
      setIsValidUrl(false);
      return;
    }

    if (validateImageUrl(displayImageUrl)) {
      setDeterminedOptimizedUrl(displayImageUrl);
      setIsValidUrl(true);
      logger.debug(`useArtworkImageHandler (${title}): Using valid URL: ${displayImageUrl}`);
    } else {
      logger.warn(`useArtworkImageHandler (${title}): Invalid URL detected: ${displayImageUrl}`);
      setDeterminedOptimizedUrl("/placeholder.svg");
      setIsValidUrl(false);
    }
  }, [displayImageUrl, title]);

  const cacheLoadedImage = () => {
    if (isValidUrl && determinedOptimizedUrl !== "/placeholder.svg") {
      logger.log(`useArtworkImageHandler (${title}): Image ready: ${determinedOptimizedUrl}`);
    }
  };

  return {
    determinedOptimizedUrl,
    initialCachedPreviewUrl: null,
    cacheLoadedImage,
  };
}
