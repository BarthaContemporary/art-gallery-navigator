import { useState, useEffect, useRef, useCallback } from "react";
import { useImageCache } from "@/hooks/use-image-cache";
import { logger } from "@/lib/logger";

export interface ImageTier {
  url: string;
  width: number;
  height: number;
  quality: number;
}

export interface OptimizedImageConfig {
  originalUrl: string;
  alt: string;
  sizes: {
    thumbnail: { width: number; height: number; quality: number };
    medium: { width: number; height: number; quality: number };
    full: { width: number; height: number; quality: number };
  };
}

export function useOptimizedImage(config: OptimizedImageConfig) {
  const [currentTier, setCurrentTier] = useState<'thumbnail' | 'medium' | 'full'>('thumbnail');
  const [isLoading, setIsLoading] = useState(true);
  const [loadedTiers, setLoadedTiers] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [blurDataUrl, setBlurDataUrl] = useState<string | null>(null);
  const { getCachedImage, setCachedImage } = useImageCache();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const generateImageUrl = useCallback((tier: 'thumbnail' | 'medium' | 'full'): string => {
    if (!config.originalUrl || config.originalUrl === "/placeholder.svg") {
      return "/placeholder.svg";
    }

    const sizeConfig = config.sizes[tier];
    
    if (config.originalUrl.includes('supabase.co/storage') && config.originalUrl.includes('/public/')) {
      const transformParams = `w=${sizeConfig.width}&h=${sizeConfig.height}&resize=contain&q=${sizeConfig.quality}&f=webp`;
      return config.originalUrl.includes('?') 
        ? `${config.originalUrl}&transform=${transformParams}`
        : `${config.originalUrl}?transform=${transformParams}`;
    }
    
    return config.originalUrl;
  }, [config]);

  const createBlurPlaceholder = useCallback(async (imageUrl: string) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      return new Promise<string>((resolve) => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          
          canvas.width = 20;
          canvas.height = 15;
          
          if (ctx) {
            ctx.drawImage(img, 0, 0, 20, 15);
            const blurUrl = canvas.toDataURL("image/jpeg", 0.1);
            resolve(blurUrl);
          } else {
            resolve("");
          }
        };
        
        img.onerror = () => resolve("");
        img.src = imageUrl;
      });
    } catch (error) {
      logger.error("Failed to create blur placeholder:", error);
      return "";
    }
  }, []);

  const loadTier = useCallback(async (tier: 'thumbnail' | 'medium' | 'full') => {
    if (!mountedRef.current) return;
    
    const imageUrl = generateImageUrl(tier);
    
    // Check cache first for this specific tier
    const cached = getCachedImage(config.originalUrl, tier);
    if (cached) {
      logger.debug(`Using cached ${tier} image: ${config.originalUrl}`);
      setLoadedTiers(prev => new Set(prev).add(tier));
      if (tier === 'thumbnail' && !blurDataUrl) {
        setBlurDataUrl(cached.dataUrl);
      }
      return imageUrl;
    }

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      return new Promise<string>((resolve, reject) => {
        img.onload = async () => {
          if (!mountedRef.current) return;
          
          setLoadedTiers(prev => new Set(prev).add(tier));
          
          // Create high-quality cached version
          try {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            
            if (ctx) {
              // Use appropriate dimensions for each tier
              const maxDimension = tier === 'thumbnail' ? 400 : tier === 'medium' ? 1200 : 2400;
              let scale = 1;
              
              if (img.width > 0 && img.height > 0) {
                scale = Math.min(maxDimension / Math.max(img.width, img.height), 1);
                if (scale <= 0) scale = 1;
              }
              
              canvas.width = Math.floor(img.width * scale);
              canvas.height = Math.floor(img.height * scale);
              
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              
              // Use high quality for caching
              const quality = tier === 'thumbnail' ? 0.85 : tier === 'medium' ? 0.98 : 1.0;
              const cachedDataUrl = canvas.toDataURL("image/webp", quality);
              setCachedImage(config.originalUrl, cachedDataUrl, tier);
              
              // Create blur placeholder from thumbnail
              if (tier === 'thumbnail') {
                const blur = await createBlurPlaceholder(imageUrl);
                if (blur) {
                  setBlurDataUrl(blur);
                }
              }
            }
          } catch (cacheError) {
            logger.error(`Error caching ${tier} image:`, cacheError);
          }
          
          resolve(imageUrl);
        };
        
        img.onerror = () => {
          if (!mountedRef.current) return;
          setError(`Failed to load ${tier} image`);
          reject(new Error(`Failed to load ${tier} image`));
        };
        
        img.src = imageUrl;
      });
    } catch (error) {
      setError(`Error loading ${tier} image`);
      throw error;
    }
  }, [config.originalUrl, generateImageUrl, getCachedImage, setCachedImage, createBlurPlaceholder, blurDataUrl]);

  const upgradeToTier = useCallback(async (targetTier: 'medium' | 'full') => {
    if (loadedTiers.has(targetTier)) {
      setCurrentTier(targetTier);
      return;
    }

    try {
      setIsLoading(true);
      await loadTier(targetTier);
      setCurrentTier(targetTier);
    } catch (error) {
      logger.error(`Failed to upgrade to ${targetTier}:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [loadedTiers, loadTier]);

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
        await loadTier('thumbnail');
        
        if (!isCancelled) {
          setIsLoading(false);
          
          // Aggressively preload medium tier
          setTimeout(() => {
            if (!isCancelled && mountedRef.current) {
              upgradeToTier('medium');
            }
          }, 50);
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
  }, [loadTier, upgradeToTier, getCachedImage, config.originalUrl]);

  return {
    currentImageUrl: generateImageUrl(currentTier),
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
