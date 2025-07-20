import { useState, useEffect, useRef, useCallback } from "react";
import { useEnhancedImageCache } from "@/hooks/use-enhanced-image-cache";
import { logger } from "@/lib/logger";
import { OptimizedImageConfig, ImageTierType } from "./types";
import { generateImageUrl } from "./url-generator";
import { useImageLoader } from "./image-loader";

export function useOptimizedImage(config: OptimizedImageConfig) {
  const [currentTier, setCurrentTier] = useState<ImageTierType>('thumbnail');
  const [isLoading, setIsLoading] = useState(true);
  const [loadedTiers, setLoadedTiers] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [blurDataUrl, setBlurDataUrl] = useState<string | null>(null);
  const { getCachedImage, warmUpCache, preloadAndCache } = useEnhancedImageCache();
  const mountedRef = useRef(true);
  const { loadTier } = useImageLoader(config);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const upgradeToTier = useCallback(async (targetTier: 'medium' | 'full') => {
    if (loadedTiers.has(targetTier)) {
      setCurrentTier(targetTier);
      return;
    }

    try {
      setIsLoading(true);
      await loadTier(targetTier, mountedRef, setLoadedTiers, blurDataUrl, setBlurDataUrl);
      setCurrentTier(targetTier);
    } catch (error) {
      logger.error(`Failed to upgrade to ${targetTier}:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [loadedTiers, loadTier, blurDataUrl]);

  // Initial load with enhanced caching check
  useEffect(() => {
    let isCancelled = false;
    
    const initialLoad = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Check if medium quality is already cached and use it directly
        const cachedMedium = getCachedImage(config.originalUrl, 'medium');
        if (cachedMedium) {
          logger.debug(`Using cached medium image directly: ${config.originalUrl}`);
          setLoadedTiers(prev => new Set(prev).add('medium'));
          setCurrentTier('medium');
          setIsLoading(false);
          return;
        }
        
        // Otherwise load thumbnail first
        await loadTier('thumbnail', mountedRef, setLoadedTiers, blurDataUrl, setBlurDataUrl);
        
        if (!isCancelled) {
          setIsLoading(false);
          
          // Preload medium tier in background
          setTimeout(() => {
            if (!isCancelled && mountedRef.current) {
              preloadAndCache(generateImageUrl(config, 'medium'), 'medium');
            }
          }, 100);
        }
      } catch (error) {
        if (!isCancelled) {
          setIsLoading(false);
          setError("Failed to load image");
        }
      }
    };

    initialLoad();
    
    return () => {
      isCancelled = true;
    };
  }, [loadTier, getCachedImage, config.originalUrl, preloadAndCache]);

  return {
    currentImageUrl: generateImageUrl(config, currentTier),
    currentTier,
    isLoading,
    error,
    blurDataUrl,
    loadedTiers,
    upgradeToTier,
    canUpgrade: {
      toMedium: !loadedTiers.has('medium'),
      toFull: !loadedTiers.has('full')
    }
  };
}

// Re-export types for backward compatibility
export type { OptimizedImageConfig, ImageTier } from "./types";
