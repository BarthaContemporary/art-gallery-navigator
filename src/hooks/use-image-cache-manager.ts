import { useEffect, useCallback } from "react";
import { useEnhancedImageCache } from "./use-enhanced-image-cache";
import { logger } from "@/lib/logger";

/**
 * Global image cache manager for coordinating cache operations
 */
export function useImageCacheManager() {
  const { warmUpCache, performCacheCleanup, cacheStats } = useEnhancedImageCache();

  // Periodic cache cleanup with proper cleanup
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      performCacheCleanup();
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => {
      clearInterval(cleanupInterval);
    };
  }, [performCacheCleanup]);

  // Warm up cache on page load with critical images
  const warmUpCriticalImages = useCallback(async (imageUrls: string[]) => {
    if (imageUrls.length === 0) return;
    
    logger.info(`Warming up cache with ${imageUrls.length} critical images`);
    
    // Warm up thumbnails first
    await warmUpCache(imageUrls.slice(0, 20), 'thumbnail');
    
    // Then warm up medium images for first 10 with cleanup
    const timeoutId = setTimeout(() => {
      warmUpCache(imageUrls.slice(0, 10), 'medium');
    }, 1000);
    
    // Return cleanup function
    return () => clearTimeout(timeoutId);
  }, [warmUpCache]);

  // Prefetch images for better user experience
  const prefetchImages = useCallback(async (imageUrls: string[], tier: 'thumbnail' | 'medium' = 'thumbnail') => {
    if (imageUrls.length === 0) return;
    
    logger.debug(`Prefetching ${imageUrls.length} images at ${tier} tier`);
    
    // Batch prefetch to avoid overwhelming the browser
    const batchSize = 5;
    for (let i = 0; i < imageUrls.length; i += batchSize) {
      const batch = imageUrls.slice(i, i + batchSize);
      await warmUpCache(batch, tier);
      
      // Small delay between batches
      if (i + batchSize < imageUrls.length) {
        await new Promise(resolve => {
          const timeoutId = setTimeout(resolve, 100);
          // Note: This is automatically cleaned up when promise resolves
        });
      }
    }
  }, [warmUpCache]);

  // Log cache statistics
  useEffect(() => {
    logger.info('Image cache stats:', cacheStats);
  }, [cacheStats]);

  return {
    warmUpCriticalImages,
    prefetchImages,
    cacheStats
  };
}