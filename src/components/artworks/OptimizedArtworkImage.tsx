
import React, { memo, useState, useEffect, useCallback } from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { logger } from "@/lib/logger";
import { Loader2 } from "lucide-react";
import { useArtworkImageHandler } from "@/hooks/use-artwork-image-handler";

interface OptimizedArtworkImageProps {
  imageUrl: string | null;
  title: string;
  onClick: () => void;
  className?: string;
  sizes?: { // Kept for API compatibility, though not directly used by the hook in this version
    thumbnail: { width: number; height: number; quality: number };
    medium: { width: number; height: number; quality: number };
    full: { width: number; height: number; quality: number };
  };
}

function OptimizedArtworkImageComponent({ 
  imageUrl, 
  title, 
  onClick, 
  className = "",
  // sizes // Prop available if needed in future hook enhancements
}: OptimizedArtworkImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  // currentDisplayUrl is the URL that will be passed to the <img> src attribute.
  const [currentDisplayUrl, setCurrentDisplayUrl] = useState<string>("/placeholder.svg");

  const isListView = !!className;

  const {
    determinedOptimizedUrl,
    initialCachedPreviewUrl,
    cacheLoadedImage,
  } = useArtworkImageHandler({ imageUrl, title, isListView });

  useEffect(() => {
    setIsLoading(true); // Reset loading state when the source URL might change
    setCurrentDisplayUrl(determinedOptimizedUrl); // Update the display URL based on hook's determination
  }, [imageUrl, determinedOptimizedUrl]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  }, [onClick]);

  const handleImageLoad = useCallback(() => {
    logger.debug(`OptimizedArtworkImage: Image loaded: ${currentDisplayUrl}`);
    setIsLoading(false);
    if (currentDisplayUrl && currentDisplayUrl !== "/placeholder.svg") {
      cacheLoadedImage(currentDisplayUrl);
    }
  }, [currentDisplayUrl, cacheLoadedImage]);

  const handleImageError = useCallback(() => {
    logger.warn(`OptimizedArtworkImage: Error loading image: ${currentDisplayUrl}. Falling back to placeholder.`);
    if (currentDisplayUrl !== "/placeholder.svg") {
      setCurrentDisplayUrl("/placeholder.svg");
    }
    setIsLoading(false);
  }, [currentDisplayUrl]);

  if (className) { // List view (simple img tag)
    return (
      <img
        src={currentDisplayUrl}
        alt={title}
        className={className}
        onClick={handleClick}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
        decoding="async"
        style={{ contain: 'layout' }}
      />
    );
  }

  // Card view
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
        {isLoading && initialCachedPreviewUrl && (
            <img 
              src={initialCachedPreviewUrl}
              alt={`Preview for ${title}`}
              className="absolute inset-0 h-full w-full object-cover opacity-80"
              aria-hidden="true"
              style={{ contain: 'layout' }}
            />
          )}
        
        {isLoading && !initialCachedPreviewUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          )}
        
        <img
          src={currentDisplayUrl}
          alt={title}
          className={`absolute inset-0 h-full w-full object-cover transition-transform duration-300 ${
            isLoading ? 'scale-105 opacity-0' : 'scale-100 opacity-100' 
          }`}
          onLoad={handleImageLoad}
          onError={handleImageError}
          loading="lazy"
          decoding="async"
          style={{ contain: 'layout' }}
        />
        
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-black/50 text-white text-xs px-2 py-1 rounded">
            {currentDisplayUrl?.includes('res.cloudinary.com') ? 'CDN' : 
             (currentDisplayUrl !== "/placeholder.svg" ? 'HD' : '')}
          </div>
        </div>
      </AspectRatio>
    </div>
  );
}

export const OptimizedArtworkImage = memo(OptimizedArtworkImageComponent);

