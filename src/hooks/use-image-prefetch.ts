
import { useCallback, useRef, useEffect } from "react";
import { useImageCache } from "./use-image-cache";
import { logger } from "@/lib/logger";

interface PrefetchQueueItem {
  imageUrl: string;
  tier: 'medium' | 'full';
  priority: number;
  sizes: {
    thumbnail: { width: number; height: number; quality: number };
    medium: { width: number; height: number; quality: number };
    full: { width: number; height: number; quality: number };
  };
}

export function useImagePrefetch() {
  const { getCachedImage, setCachedImage } = useImageCache();
  const prefetchQueue = useRef<PrefetchQueueItem[]>([]);
  const activePrefetches = useRef<Set<string>>(new Set());
  const maxConcurrentPrefetches = 3;

  const generateImageUrl = useCallback((originalUrl: string, tier: 'thumbnail' | 'medium' | 'full', sizes: any): string => {
    if (!originalUrl || originalUrl === "/placeholder.svg") {
      return "/placeholder.svg";
    }

    const sizeConfig = sizes[tier];
    
    if (originalUrl.includes('supabase.co/storage') && originalUrl.includes('/public/')) {
      const transformParams = `w=${sizeConfig.width}&h=${sizeConfig.height}&resize=contain&q=${sizeConfig.quality}&f=webp`;
      return originalUrl.includes('?') 
        ? `${originalUrl}&transform=${transformParams}`
        : `${originalUrl}?transform=${transformParams}`;
    }
    
    return originalUrl;
  }, []);

  const prefetchImage = useCallback(async (item: PrefetchQueueItem) => {
    const { imageUrl, tier, sizes } = item;
    const cacheKey = `${imageUrl}_${tier}`;
    
    if (activePrefetches.current.has(cacheKey)) {
      return;
    }

    // Check if already cached
    const cached = getCachedImage(imageUrl, tier);
    if (cached) {
      logger.debug(`Image already cached: ${imageUrl} (${tier})`);
      return;
    }

    activePrefetches.current.add(cacheKey);
    
    try {
      const optimizedUrl = generateImageUrl(imageUrl, tier, sizes);
      logger.debug(`Prefetching ${tier} image: ${optimizedUrl}`);
      
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      await new Promise<void>((resolve, reject) => {
        img.onload = async () => {
          try {
            // Create canvas and cache the image
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            
            if (!ctx) {
              reject(new Error('Could not get canvas context'));
              return;
            }
            
            // Set canvas size based on tier
            const maxDimension = tier === 'medium' ? 1200 : 2400;
            let scale = 1;
            
            if (img.width > 0 && img.height > 0) {
              scale = Math.min(maxDimension / Math.max(img.width, img.height), 1);
              if (scale <= 0) scale = 1;
            }
            
            canvas.width = Math.floor(img.width * scale);
            canvas.height = Math.floor(img.height * scale);
            
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Cache with high quality
            const quality = tier === 'medium' ? 0.98 : 1.0;
            const cachedDataUrl = canvas.toDataURL("image/webp", quality);
            setCachedImage(imageUrl, cachedDataUrl, tier);
            
            logger.log(`Successfully prefetched and cached ${tier} image: ${imageUrl}`);
            resolve();
          } catch (error) {
            logger.error(`Error processing prefetched image: ${imageUrl}`, error);
            reject(error);
          }
        };
        
        img.onerror = () => {
          logger.error(`Failed to prefetch image: ${optimizedUrl}`);
          reject(new Error(`Failed to load image: ${optimizedUrl}`));
        };
        
        img.src = optimizedUrl;
      });
    } catch (error) {
      logger.error(`Prefetch failed for ${imageUrl} (${tier}):`, error);
    } finally {
      activePrefetches.current.delete(cacheKey);
    }
  }, [generateImageUrl, getCachedImage, setCachedImage]);

  const processQueue = useCallback(async () => {
    if (prefetchQueue.current.length === 0 || activePrefetches.current.size >= maxConcurrentPrefetches) {
      return;
    }

    // Sort by priority (higher priority first)
    prefetchQueue.current.sort((a, b) => b.priority - a.priority);
    
    const item = prefetchQueue.current.shift();
    if (item) {
      await prefetchImage(item);
      // Process next item after a short delay
      setTimeout(processQueue, 100);
    }
  }, [prefetchImage]);

  const addToPrefetchQueue = useCallback((
    imageUrl: string, 
    tier: 'medium' | 'full', 
    priority: number,
    sizes: any
  ) => {
    // Don't add duplicates
    const exists = prefetchQueue.current.some(
      item => item.imageUrl === imageUrl && item.tier === tier
    );
    
    if (!exists) {
      prefetchQueue.current.push({ imageUrl, tier, priority, sizes });
      // Start processing if not already running
      setTimeout(processQueue, 50);
    }
  }, [processQueue]);

  const prefetchArtworkImages = useCallback((
    artworkImages: Array<{ imageUrl: string | null; priority?: number }>,
    sizes: any
  ) => {
    artworkImages.forEach(({ imageUrl, priority = 1 }) => {
      if (imageUrl && imageUrl !== "/placeholder.svg") {
        // Prefetch medium quality for better UX
        addToPrefetchQueue(imageUrl, 'medium', priority, sizes);
      }
    });
  }, [addToPrefetchQueue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      prefetchQueue.current = [];
      activePrefetches.current.clear();
    };
  }, []);

  return {
    prefetchArtworkImages,
    addToPrefetchQueue,
    queueLength: prefetchQueue.current.length,
    activePrefetches: activePrefetches.current.size
  };
}
