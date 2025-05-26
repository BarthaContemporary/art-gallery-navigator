
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useRef } from "react";
import { useImageCache } from "@/hooks/use-image-cache";

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
    setPlaceholderUrl(null);
    imageLoadAttempted.current = false;
    
    if (!imageUrl) {
      setOptimizedUrl("/placeholder.svg");
      setIsLoading(false);
      return;
    }

    // Check cache first
    const cachedImage = getCachedImage(imageUrl);
    if (cachedImage) {
      setPlaceholderUrl(cachedImage.dataUrl);
      // Still load the full image but with a nice placeholder
    }

    // For thumbnails in cards, use a smaller image size if possible
    if (imageUrl.includes('supabase.co/storage')) {
      // This could be enhanced with actual resize parameters if your storage supports it
      setOptimizedUrl(imageUrl);
    } else {
      setOptimizedUrl(imageUrl);
    }
  }, [imageUrl, getCachedImage]);

  // Function to create and cache a version for placeholders
  const cacheImageIfNeeded = () => {
    if (!optimizedUrl || optimizedUrl === "/placeholder.svg" || imageLoadAttempted.current) return;
    
    imageLoadAttempted.current = true;
    
    try {
      const img = new Image();
      img.crossOrigin = "anonymous"; // This is needed for some external images
      img.onload = () => {
        // Create a smaller, more compressed version for card placeholders
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        // Reduced max dimension for card placeholders to 600px (was 1000)
        const maxDimension = 600; 
        let scale = 1;
        if (img.width > 0 && img.height > 0) { // Ensure dimensions are positive
            scale = maxDimension / Math.max(img.width, img.height);
            // Ensure scale is not greater than 1 to avoid upscaling
            scale = Math.min(1, scale); 
        } else { // Fallback if image dimensions are not available or zero
            canvas.width = Math.min(maxDimension, img.width || maxDimension);
            canvas.height = Math.min(maxDimension, img.height || maxDimension);
        }
        
        if (img.width > 0 && img.height > 0) {
            canvas.width = Math.floor(img.width * scale);
            canvas.height = Math.floor(img.height * scale);
        }


        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Using JPEG quality of 0.8 (was 1.0)
          const placeholderDataUrl = canvas.toDataURL("image/jpeg", 0.8); 
          setCachedImage(optimizedUrl, placeholderDataUrl);
        }
      };
      img.src = optimizedUrl;
    } catch (error) {
      console.error("Failed to cache image for placeholder:", error);
    }
  };

  return (
    <div 
      className="aspect-[4/3] w-full overflow-hidden cursor-pointer relative group"
      onClick={onClick}
    >
      <AspectRatio ratio={4/3}>
        {isLoading && (
          <Skeleton className="h-full w-full absolute inset-0" />
        )}
        
        {/* Show cached placeholder while loading */}
        {placeholderUrl && isLoading && (
          <img 
            src={placeholderUrl}
            alt={`Loading ${title}`}
            className="h-full w-full object-cover opacity-70"
            aria-hidden="true"
          />
        )}
        
        <img
          src={optimizedUrl || "/placeholder.svg"}
          alt={title}
          className={`h-full w-full object-cover transition-all duration-300 opacity-80 group-hover:opacity-100 group-hover:scale-105 ${
            isLoading ? 'opacity-0' : ''
          }`}
          onLoad={() => {
            setIsLoading(false);
            cacheImageIfNeeded();
          }}
          onError={() => {
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
