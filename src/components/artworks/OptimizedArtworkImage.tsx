import React, { memo, useState, useEffect, useCallback } from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { logger } from "@/lib/logger";
import { Loader2 } from "lucide-react";
import { useArtworkImageHandler } from "@/hooks/use-artwork-image-handler";
import type { ArtworkImage } from "@/hooks/use-artwork-images"; // Changed import

interface OptimizedArtworkImageProps {
  imageRecord: ArtworkImage | null | undefined; // Changed type to ArtworkImage
  title: string;
  onClick: () => void;
  className?: string;
  sizes?: { 
    thumbnail: { width: number; height: number; quality: number };
    medium: { width: number; height: number; quality: number };
    full: { width: number; height: number; quality: number };
  };
}

function OptimizedArtworkImageComponent({ 
  imageRecord, 
  title, 
  onClick, 
  className = "",
  // sizes // sizes is not directly used for URL construction anymore with Cloudinary fields
}: OptimizedArtworkImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const isListView = !!className;

  // Determine which Cloudinary URL to use based on context (list vs. card/detail)
  // and the type of image for caching.
  // imageRecord now contains specific thumbnail_url and medium_url from Cloudinary
  const displayUrl = isListView 
    ? imageRecord?.thumbnail_url || imageRecord?.medium_url || imageRecord?.image_url // Prefer Cloudinary thumbnail for list view, then medium, then original
    : imageRecord?.medium_url || imageRecord?.image_url;   // Prefer Cloudinary medium for card/detail view, then original
  
  const imageTypeForCacheLogic = (): 'thumbnail' | 'medium' | 'full' => {
    if (isListView) {
      if (imageRecord?.thumbnail_url) return 'thumbnail';
    }
    if (imageRecord?.medium_url) return 'medium';
    // If only image_url (original) is available, it's considered 'full' for caching purposes
    // if it's the one being displayed.
    return 'full'; 
  };
  const imageTypeForCache = imageTypeForCacheLogic();

  const {
    determinedOptimizedUrl,
    initialCachedPreviewUrl,
    cacheLoadedImage,
  } = useArtworkImageHandler({ 
    displayImageUrl: displayUrl || null, 
    // Use artwork_images.id as a stable cache key.
    // If imageRecord is a fallback, its ID might be constructed.
    cacheKey: imageRecord?.id || null, 
    imageTypeForCache: imageTypeForCache,
    title,
  });

  const currentDisplayUrl = determinedOptimizedUrl;

  useEffect(() => {
    if (currentDisplayUrl && !currentDisplayUrl.startsWith("data:") && currentDisplayUrl !== "/placeholder.svg") {
      setIsLoading(true);
    } else {
      setIsLoading(false); 
    }
  }, [currentDisplayUrl]);


  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  }, [onClick]);

  const handleImageLoad = useCallback(() => {
    logger.debug(`OptimizedArtworkImage: Image loaded: ${currentDisplayUrl}`);
    setIsLoading(false);
    if (currentDisplayUrl && currentDisplayUrl !== "/placeholder.svg" && !currentDisplayUrl.startsWith("data:")) {
      cacheLoadedImage(currentDisplayUrl);
    }
  }, [currentDisplayUrl, cacheLoadedImage]);

  const handleImageError = useCallback(() => {
    logger.warn(`OptimizedArtworkImage: Error loading image: ${currentDisplayUrl}.`);
    setIsLoading(false);
  }, [currentDisplayUrl]);
  
  if (!imageRecord || (currentDisplayUrl === "/placeholder.svg" && !initialCachedPreviewUrl)) {
    const placeholderContent = (
      <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
    if (isListView) {
        return (
            <div 
                className={`${className} flex items-center justify-center bg-muted/30`} 
                onClick={handleClick}
                style={{ aspectRatio: '1 / 1', width: '100%', height: 'auto', contain: 'layout' }}
            >
                 <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }
    return (
        <div 
            className="aspect-[4/3] w-full overflow-hidden cursor-pointer relative group bg-muted/30"
            onClick={handleClick}
            style={{ contain: 'layout style', minHeight: '200px', willChange: 'transform' }}
        >
            <AspectRatio ratio={4/3}>{placeholderContent}</AspectRatio>
        </div>
    );
  }


  if (isListView) {
    return (
      <img
        src={initialCachedPreviewUrl || currentDisplayUrl}
        alt={title}
        className={className}
        onClick={handleClick}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
        decoding="async"
        style={{ 
          opacity: isLoading && !initialCachedPreviewUrl ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out',
          contain: 'layout' 
        }}
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
        {initialCachedPreviewUrl && (
            <img 
              src={initialCachedPreviewUrl}
              alt={`Preview for ${title}`}
              className="absolute inset-0 h-full w-full object-cover opacity-70 blur-sm"
              aria-hidden="true"
              style={{ contain: 'layout' }}
            />
          )}
        
        {isLoading && !initialCachedPreviewUrl && currentDisplayUrl !== "/placeholder.svg" && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/40">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          )}
        
        <img
          src={currentDisplayUrl}
          alt={title}
          className={`absolute inset-0 h-full w-full object-cover transition-all duration-300 ease-in-out group-hover:scale-105 ${
            (isLoading && !initialCachedPreviewUrl && currentDisplayUrl !== "/placeholder.svg") ? 'opacity-0 scale-110' : 'opacity-100 scale-100' 
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
             (currentDisplayUrl !== "/placeholder.svg" && !currentDisplayUrl.startsWith("data:")) ? 'Source' : 
             (currentDisplayUrl.startsWith("data:")) ? 'Cached' : ''}
          </div>
        </div>
      </AspectRatio>
    </div>
  );
}

export const OptimizedArtworkImage = memo(OptimizedArtworkImageComponent);
