
import { useState, useEffect, useCallback, useRef } from 'react';
import { useImageCache } from '@/hooks/use-image-cache';
import { logger } from '@/lib/logger';

interface UseArtworkImageHandlerProps {
  imageUrl: string | null;
  title: string;
  isListView: boolean; // True if it's for a list view (smaller image)
}

export function useArtworkImageHandler({ imageUrl, title, isListView }: UseArtworkImageHandlerProps) {
  const [determinedOptimizedUrl, setDeterminedOptimizedUrl] = useState<string>("/placeholder.svg");
  const [initialCachedPreviewUrl, setInitialCachedPreviewUrl] = useState<string | null>(null);
  const { getCachedImage, setCachedImage } = useImageCache();
  const imageLoadAttemptedRef = useRef(false);

  useEffect(() => {
    setDeterminedOptimizedUrl("/placeholder.svg");
    setInitialCachedPreviewUrl(null);
    imageLoadAttemptedRef.current = false;

    if (!imageUrl) {
      logger.debug(`useArtworkImageHandler (${title}): No imageUrl, using placeholder.`);
      setDeterminedOptimizedUrl("/placeholder.svg");
      return;
    }

    const cachedMedium = getCachedImage(imageUrl, 'medium');
    if (cachedMedium) {
      logger.debug(`useArtworkImageHandler (${title}): Found cached medium for ${imageUrl}`);
      setInitialCachedPreviewUrl(cachedMedium.dataUrl);
      // If medium cache exists, we will use it as the primary URL to load
      setDeterminedOptimizedUrl(cachedMedium.dataUrl);
      // If we use cachedMedium as determinedOptimizedUrl, subsequent network fetch for the *same* URL might be redundant
      // However, this matches original behavior where optimizedUrl could be a cached data URL.
    } else {
      // Only check for thumbnail if medium wasn't found for preview
      const cachedThumbnail = getCachedImage(imageUrl, 'thumbnail');
      if (cachedThumbnail) {
        logger.debug(`useArtworkImageHandler (${title}): Found cached thumbnail for ${imageUrl}`);
        setInitialCachedPreviewUrl(cachedThumbnail.dataUrl);
      }
    }

    let finalUrlToAttempt = imageUrl;
    if (imageUrl.includes('res.cloudinary.com')) {
      const baseUrl = imageUrl.split('/upload/')[0];
      const imagePath = imageUrl.split('/upload/')[1];
      const transform = isListView
        ? 'w_256,h_192,c_limit,q_85,f_webp' // List view
        : 'w_600,h_450,c_limit,q_90,f_webp'; // Card view
      finalUrlToAttempt = `${baseUrl}/upload/${transform}/${imagePath}`;
      logger.debug(`useArtworkImageHandler (${title}): Using optimized Cloudinary URL: ${finalUrlToAttempt}`);
    } else if (imageUrl.includes('supabase.co/storage') && imageUrl.includes('/public/')) {
      const transformParams = "w=1200&h=1200&resize=contain&q=100&f=webp";
      finalUrlToAttempt = imageUrl.includes('?')
        ? `${imageUrl}&transform=${transformParams}`
        : `${imageUrl}?transform=${transformParams}`;
      logger.debug(`useArtworkImageHandler (${title}): Applying Supabase transform. Original: ${imageUrl}, Optimized: ${finalUrlToAttempt}`);
    }
    
    // If medium cache was not found and used above, set determinedOptimizedUrl to the network URL.
    if (!cachedMedium) {
        setDeterminedOptimizedUrl(finalUrlToAttempt);
    }

  }, [imageUrl, title, isListView, getCachedImage]);

  const cacheLoadedImage = useCallback((loadedSrc: string) => {
    if (!imageUrl || loadedSrc === "/placeholder.svg" || imageLoadAttemptedRef.current) {
      return;
    }
    
    imageLoadAttemptedRef.current = true;
    logger.debug(`useArtworkImageHandler (${title}): Attempting to cache medium quality from loaded source. Original Key: ${imageUrl}, Source: ${loadedSrc}`);

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        logger.debug(`useArtworkImageHandler (${title}): Image loaded for caching (source: ${loadedSrc}), creating high-quality cache.`);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        const maxDimension = 1200;
        let scale = 1;
        if (img.width > 0 && img.height > 0) {
          scale = Math.min(maxDimension / Math.max(img.width, img.height), 1);
          if (scale <= 0) scale = 1;
        }

        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);
        
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const highQualityDataUrl = canvas.toDataURL("image/webp", 0.98);
          setCachedImage(imageUrl, highQualityDataUrl, 'medium');
          logger.log(`useArtworkImageHandler (${title}): Cached high-quality medium image for ${imageUrl}. Size: ${highQualityDataUrl.length}`);
        }
      };
      img.onerror = () => {
        logger.error(`useArtworkImageHandler (${title}): Failed to load image for caching: ${loadedSrc}`);
      };
      img.src = loadedSrc;
    } catch (error) {
      logger.error(`useArtworkImageHandler (${title}): Failed to cache image:`, error);
    }
  }, [imageUrl, title, setCachedImage]);

  return {
    determinedOptimizedUrl,
    initialCachedPreviewUrl,
    cacheLoadedImage,
  };
}

