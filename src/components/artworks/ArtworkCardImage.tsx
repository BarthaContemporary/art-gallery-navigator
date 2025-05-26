
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useRef } from "react";
import { useImageCache } from "@/hooks/use-image-cache";
import { logger } from "@/lib/logger";

interface ArtworkCardImageProps {
  imageUrl: string | null;
  title: string;
  onClick: () => void;
}

export function ArtworkCardImage({ imageUrl, title, onClick }: ArtworkCardImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [optimizedUrl, setOptimizedUrl] = useState<string | null>(null);
  const [placeholderUrl, setPlaceholderUrl] = useState<string | null>(null);
  const { getCachedImage, setCachedImage } = useImageCache();
  const imageLoadAttempted = useRef(false);

  useEffect(() => {
    // Reset states when image URL changes
    setIsLoading(true);
    setPlaceholderUrl(null); // Clear previous placeholder
    imageLoadAttempted.current = false;
    
    if (!imageUrl) {
      logger.debug("ArtworkCardImage: No imageUrl provided, using default placeholder.");
      setOptimizedUrl("/placeholder.svg");
      setIsLoading(false);
      return;
    }

    // Check cache first
    const cachedImage = getCachedImage(imageUrl); // Use original imageUrl as cache key
    if (cachedImage) {
      logger.debug(`ArtworkCardImage: Found cached placeholder for ${imageUrl}`);
      setPlaceholderUrl(cachedImage.dataUrl);
      // Still load the full/optimized image but with a nice placeholder
    }

    let finalOptimizedUrl = imageUrl;
    // For thumbnails in cards, use a larger image size and higher quality if possible via Supabase transform
    if (imageUrl.includes('supabase.co/storage') && imageUrl.includes('/public/')) { // Ensure it's a public Supabase storage URL
      const transformParams = "w=800&q=90&f=auto"; // Width 800px, quality 90, auto format
      if (imageUrl.includes('?')) {
        finalOptimizedUrl = `${imageUrl}&transform=${transformParams}`;
      } else {
        finalOptimizedUrl = `${imageUrl}?transform=${transformParams}`;
      }
      logger.debug(`ArtworkCardImage: Applying Supabase transform. Original: ${imageUrl}, Optimized: ${finalOptimizedUrl}`);
    } else {
      logger.debug(`ArtworkCardImage: Not a Supabase public URL or no transformation applied for ${imageUrl}`);
    }
    setOptimizedUrl(finalOptimizedUrl);

  }, [imageUrl, getCachedImage]);

  // Function to create and cache a version for placeholders
  // This will now cache the server-optimized image (if applicable) or the original image
  const cacheImageIfNeeded = () => {
    // Use original imageUrl as the primary key for caching,
    // but the content cached is derived from optimizedUrl (which might be server-transformed)
    if (!imageUrl || !optimizedUrl || optimizedUrl === "/placeholder.svg" || imageLoadAttempted.current) return;
    
    imageLoadAttempted.current = true; // Attempt to load and cache this version
    
    logger.debug(`ArtworkCardImage: Attempting to cache image. Original Key: ${imageUrl}, Source for Cache: ${optimizedUrl}`);

    try {
      const img = new Image();
      img.crossOrigin = "anonymous"; 
      img.onload = () => {
        logger.debug(`ArtworkCardImage: Image loaded for caching (source: ${optimizedUrl}), creating canvas placeholder.`);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        // Max dimension for the canvas-generated placeholder (consistency)
        // Keeping placeholder generation logic the same, but it's based on the higher quality optimizedUrl
        const maxDimension = 600; 
        let scale = 1;
        if (img.width > 0 && img.height > 0) {
            scale = maxDimension / Math.max(img.width, img.height);
            scale = Math.min(1, scale); 
        } else { 
            canvas.width = Math.min(maxDimension, img.width || maxDimension);
            canvas.height = Math.min(maxDimension, img.height || maxDimension);
        }
        
        if (img.width > 0 && img.height > 0) {
            canvas.width = Math.floor(img.width * scale);
            canvas.height = Math.floor(img.height * scale);
        }

        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const placeholderDataUrl = canvas.toDataURL("image/jpeg", 0.85); // Updated quality to 0.85
          setCachedImage(imageUrl, placeholderDataUrl); // Cache using original imageUrl as key
          logger.log(`ArtworkCardImage: Cached placeholder for ${imageUrl} (from ${optimizedUrl}). Size: ${placeholderDataUrl.length}`);
        }
      };
      img.onerror = () => {
          logger.error(`ArtworkCardImage: Failed to load image for caching: ${optimizedUrl}`);
      }
      img.src = optimizedUrl; // Load the (potentially server-optimized) image
    } catch (error) {
      logger.error("ArtworkCardImage: Failed to cache image for placeholder:", error);
    }
  };

  return (
    <div 
      className="aspect-[4/3] w-full overflow-hidden cursor-pointer relative group bg-muted/30" // Added a subtle bg
      onClick={onClick}
    >
      <AspectRatio ratio={4/3}>
        {isLoading && (
          <Skeleton className="h-full w-full absolute inset-0" />
        )}
        
        {placeholderUrl && isLoading && (
          <img 
            src={placeholderUrl}
            alt={`Loading ${title}`}
            className="h-full w-full object-cover opacity-70 blur-sm" // Added blur for placeholder
            aria-hidden="true"
          />
        )}
        
        <img
          src={optimizedUrl || "/placeholder.svg"}
          alt={title}
          className={`h-full w-full object-cover transition-all duration-300 group-hover:opacity-100 group-hover:scale-105 ${
            isLoading ? 'opacity-0' : 'opacity-80' // Start with opacity-80 when loaded
          }`}
          onLoad={() => {
            logger.debug(`ArtworkCardImage: Image loaded: ${optimizedUrl}`);
            setIsLoading(false);
            // Only attempt to cache if it's not already the default placeholder
            if (optimizedUrl && optimizedUrl !== "/placeholder.svg") {
              cacheImageIfNeeded();
            }
          }}
          onError={() => {
            logger.warn(`ArtworkCardImage: Error loading image: ${optimizedUrl}. Falling back to placeholder.`);
            setOptimizedUrl("/placeholder.svg");
            setIsLoading(false);
          }}
          loading="lazy"
          decoding="async"
        />
      </AspectRatio>
    </div>
  );
}

