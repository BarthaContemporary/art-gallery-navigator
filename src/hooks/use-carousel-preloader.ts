
import { useEffect, useRef, useCallback } from "react";
import { CloudinaryImageService } from "@/services/cloudinary-image-service";
import type { LocalImageRecord } from "@/services/local-image-service";

interface UseCarouselPreloaderOptions {
  images: LocalImageRecord[];
  currentIndex: number;
  preloadRadius?: number;
  enabled?: boolean;
}

export function useCarouselPreloader({
  images,
  currentIndex,
  preloadRadius = 2,
  enabled = true
}: UseCarouselPreloaderOptions) {
  const preloadedRef = useRef<Set<string>>(new Set());
  const preloadingRef = useRef<Set<string>>(new Set());

  const preloadImage = useCallback(async (imageRecord: LocalImageRecord, tier: 'thumbnail' | 'medium' = 'thumbnail') => {
    const key = `${imageRecord.id}-${tier}`;
    
    // Skip if already preloaded or currently preloading
    if (preloadedRef.current.has(key) || preloadingRef.current.has(key)) {
      return;
    }

    preloadingRef.current.add(key);

    try {
      const url = CloudinaryImageService.getBestImageUrl(imageRecord, tier);
      
      if (url && url !== '/placeholder.svg') {
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            preloadedRef.current.add(key);
            resolve();
          };
          img.onerror = reject;
          img.src = url;
        });
      }
    } catch (error) {
      console.debug(`Preload failed for image ${imageRecord.id}:`, error);
    } finally {
      preloadingRef.current.delete(key);
    }
  }, []);

  // Preload images around current index
  useEffect(() => {
    if (!enabled || images.length === 0) return;

    const preloadImages = async () => {
      const promises: Promise<void>[] = [];
      
      // Calculate preload range
      const start = Math.max(0, currentIndex - preloadRadius);
      const end = Math.min(images.length - 1, currentIndex + preloadRadius);

      for (let i = start; i <= end; i++) {
        const image = images[i];
        if (image) {
          // Prioritize current image and immediate neighbors
          const distance = Math.abs(i - currentIndex);
          
          if (distance === 0) {
            // Current image: preload medium quality immediately
            promises.push(preloadImage(image, 'medium'));
          } else if (distance === 1) {
            // Adjacent images: preload thumbnail immediately, medium with delay
            promises.push(preloadImage(image, 'thumbnail'));
            setTimeout(() => {
              preloadImage(image, 'medium');
            }, 100 * distance);
          } else {
            // Further images: preload thumbnail only with delay
            setTimeout(() => {
              preloadImage(image, 'thumbnail');
            }, 200 * distance);
          }
        }
      }

      await Promise.allSettled(promises);
    };

    // Debounce preloading to avoid excessive calls during rapid navigation
    const timeoutId = setTimeout(preloadImages, 50);
    
    return () => clearTimeout(timeoutId);
  }, [images, currentIndex, preloadRadius, enabled, preloadImage]);

  // Connection-aware preloading
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined') return;

    // Check connection quality and adjust preload strategy
    const connection = (navigator as any).connection;
    if (connection) {
      const isSlowConnection = connection.effectiveType === 'slow-2g' || 
                              connection.effectiveType === '2g' ||
                              connection.saveData;
      
      if (isSlowConnection) {
        console.log('Slow connection detected, reducing preload radius');
        // Reduce preload radius for slow connections
        // This is handled by the parent component
      }
    }
  }, [enabled]);

  const clearPreloadCache = useCallback(() => {
    preloadedRef.current.clear();
    preloadingRef.current.clear();
  }, []);

  return {
    preloadedCount: preloadedRef.current.size,
    isPreloading: preloadingRef.current.size > 0,
    clearPreloadCache
  };
}
