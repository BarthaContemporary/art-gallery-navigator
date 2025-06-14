
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useState, useEffect, useRef } from "react";
import { useImageCache } from "@/hooks/use-image-cache";
import { logger } from "@/lib/logger";
import { Loader2 } from "lucide-react";

interface OptimizedArtworkImageProps {
  imageUrl: string | null;
  title: string;
  onClick: () => void;
  className?: string;
  sizes?: {
    thumbnail: { width: number; height: number; quality: number };
    medium: { width: number; height: number; quality: number };
    full: { width: number; height: number; quality: number };
  };
}

export function OptimizedArtworkImage({ 
  imageUrl, 
  title, 
  onClick, 
  className = "",
  sizes 
}: OptimizedArtworkImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [optimizedUrl, setOptimizedUrl] = useState<string | null>(null);
  const [cachedImageUrl, setCachedImageUrl] = useState<string | null>(null);
  const { getCachedImage, setCachedImage } = useImageCache();
  const imageLoadAttempted = useRef(false);

  useEffect(() => {
    setIsLoading(true);
    setCachedImageUrl(null);
    imageLoadAttempted.current = false;
    
    if (!imageUrl) {
      logger.debug("OptimizedArtworkImage: No imageUrl provided, using default placeholder.");
      setOptimizedUrl("/placeholder.svg");
      setIsLoading(false);
      return;
    }

    // Check for cached medium quality image first (preferred)
    const cachedMedium = getCachedImage(imageUrl, 'medium');
    if (cachedMedium) {
      logger.debug(`OptimizedArtworkImage: Found cached medium quality image for ${imageUrl}`);
      setCachedImageUrl(cachedMedium.dataUrl);
      setIsLoading(false);
      setOptimizedUrl(cachedMedium.dataUrl);
      return;
    }

    // Fallback to cached thumbnail
    const cachedThumbnail = getCachedImage(imageUrl, 'thumbnail');
    if (cachedThumbnail) {
      logger.debug(`OptimizedArtworkImage: Found cached thumbnail for ${imageUrl}`);
      setCachedImageUrl(cachedThumbnail.dataUrl);
    }

    // Check if this is already a Cloudinary URL (processed image)
    let finalOptimizedUrl = imageUrl;
    if (imageUrl.includes('res.cloudinary.com')) {
      // Already a Cloudinary URL, optimize for component size
      const baseUrl = imageUrl.split('/upload/')[0];
      const imagePath = imageUrl.split('/upload/')[1];
      // Use appropriate size based on className presence (list view vs card view)
      const transform = className 
        ? 'w_256,h_192,c_limit,q_85,f_webp' // List view - smaller
        : 'w_600,h_450,c_limit,q_90,f_webp'; // Card view - larger
      finalOptimizedUrl = `${baseUrl}/upload/${transform}/${imagePath}`;
      logger.debug(`OptimizedArtworkImage: Using optimized Cloudinary URL: ${finalOptimizedUrl}`);
    } else if (imageUrl.includes('supabase.co/storage') && imageUrl.includes('/public/')) {
      // Supabase storage URL - apply transforms for backwards compatibility
      const transformParams = "w=1200&h=1200&resize=contain&q=100&f=webp";
      finalOptimizedUrl = imageUrl.includes('?') 
        ? `${imageUrl}&transform=${transformParams}`
        : `${imageUrl}?transform=${transformParams}`;
      logger.debug(`OptimizedArtworkImage: Applying Supabase transform. Original: ${imageUrl}, Optimized: ${finalOptimizedUrl}`);
    }
    
    setOptimizedUrl(finalOptimizedUrl);

  }, [imageUrl, getCachedImage, className]);

  const cacheImageIfNeeded = () => {
    if (!imageUrl || !optimizedUrl || optimizedUrl === "/placeholder.svg" || imageLoadAttempted.current) return;
    
    imageLoadAttempted.current = true;
    
    logger.debug(`OptimizedArtworkImage: Attempting to cache medium quality image. Original Key: ${imageUrl}, Source: ${optimizedUrl}`);

    try {
      const img = new Image();
      img.crossOrigin = "anonymous"; 
      img.onload = () => {
        logger.debug(`OptimizedArtworkImage: Image loaded for caching (source: ${optimizedUrl}), creating high-quality cache.`);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        // Use higher resolution for caching (1200x1200)
        const maxDimension = 1200;
        let scale = 1;
        if (img.width > 0 && img.height > 0) {
            scale = Math.min(maxDimension / Math.max(img.width, img.height), 1);
            if (scale <= 0) scale = 1;
        }
        
        if (img.width > 0 && img.height > 0) {
            canvas.width = Math.floor(img.width * scale);
            canvas.height = Math.floor(img.height * scale);
        } else {
            canvas.width = maxDimension;
            canvas.height = maxDimension;
        }

        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Use high quality for medium tier caching
          const highQualityDataUrl = canvas.toDataURL("image/webp", 0.98);
          setCachedImage(imageUrl, highQualityDataUrl, 'medium');
          logger.log(`OptimizedArtworkImage: Cached high-quality medium image for ${imageUrl}. Size: ${highQualityDataUrl.length}`);
        }
      };
      img.onerror = () => {
          logger.error(`OptimizedArtworkImage: Failed to load image for caching: ${optimizedUrl}`);
      }
      img.src = optimizedUrl;
    } catch (error) {
      logger.error("OptimizedArtworkImage: Failed to cache image:", error);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  };

  // If className is provided, render as a simple img tag for list view
  if (className) {
    return (
      <img
        src={optimizedUrl || "/placeholder.svg"}
        alt={title}
        className={className}
        onClick={handleClick}
        onLoad={() => {
          logger.debug(`OptimizedArtworkImage: High-quality image loaded: ${optimizedUrl}`);
          setIsLoading(false);
          if (optimizedUrl && optimizedUrl !== "/placeholder.svg") {
            cacheImageIfNeeded();
          }
        }}
        onError={() => {
          logger.warn(`OptimizedArtworkImage: Error loading image: ${optimizedUrl}. Falling back to placeholder.`);
          setOptimizedUrl("/placeholder.svg");
          setIsLoading(false);
        }}
        loading="lazy"
        decoding="async"
        style={{ contain: 'layout' }}
      />
    );
  }

  return (
    <div 
      className="aspect-[4/3] w-full overflow-hidden cursor-pointer relative group bg-muted/30"
      onClick={handleClick}
      style={{ 
        contain: 'layout style',
        minHeight: '200px',
        willChange: 'transform'
      }}
    >
      <AspectRatio ratio={4/3}>
        {/* Show cached image while main image loads */}
        {isLoading && cachedImageUrl && (
            <img 
              src={cachedImageUrl}
              alt={`Preview for ${title}`}
              className="absolute inset-0 h-full w-full object-cover opacity-80"
              aria-hidden="true"
              style={{ contain: 'layout' }}
            />
          )}
        
        {/* Loading indicator when no cached image available */}
        {isLoading && !cachedImageUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          )}
        
        {/* Main high-quality image */}
        <img
          src={optimizedUrl || "/placeholder.svg"}
          alt={title}
          className={`absolute inset-0 h-full w-full object-cover transition-transform duration-300 ${
            isLoading ? 'scale-105 opacity-0' : 'scale-100 opacity-100' 
          }`}
          onLoad={() => {
            logger.debug(`OptimizedArtworkImage: High-quality image loaded: ${optimizedUrl}`);
            setIsLoading(false);
            if (optimizedUrl && optimizedUrl !== "/placeholder.svg") {
              cacheImageIfNeeded();
            }
          }}
          onError={() => {
            logger.warn(`OptimizedArtworkImage: Error loading image: ${optimizedUrl}. Falling back to placeholder.`);
            setOptimizedUrl("/placeholder.svg");
            setIsLoading(false);
          }}
          loading="lazy"
          decoding="async"
          style={{ contain: 'layout' }}
        />
        
        {/* Quality indicator - show "CDN" for Cloudinary images */}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-black/50 text-white text-xs px-2 py-1 rounded">
            {optimizedUrl?.includes('res.cloudinary.com') ? 'CDN' : 'HD'}
          </div>
        </div>
      </AspectRatio>
    </div>
  );
}
