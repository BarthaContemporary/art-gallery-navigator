
import { useImageCache } from "@/hooks/use-image-cache";
import { logger } from "@/lib/logger";
import { OptimizedImageConfig, ImageTierType } from "./types";
import { generateImageUrl } from "./url-generator";
import { createBlurPlaceholder } from "./blur-placeholder";

export const useImageLoader = (config: OptimizedImageConfig) => {
  const { getCachedImage, setCachedImage } = useImageCache();

  const loadTier = async (
    tier: ImageTierType,
    mountedRef: React.MutableRefObject<boolean>,
    setLoadedTiers: React.Dispatch<React.SetStateAction<Set<string>>>,
    blurDataUrl: string | null,
    setBlurDataUrl: React.Dispatch<React.SetStateAction<string | null>>
  ): Promise<string> => {
    if (!mountedRef.current) return "";
    
    const imageUrl = generateImageUrl(config, tier);
    
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
          reject(new Error(`Failed to load ${tier} image`));
        };
        
        img.src = imageUrl;
      });
    } catch (error) {
      throw error;
    }
  };

  return { loadTier };
};
