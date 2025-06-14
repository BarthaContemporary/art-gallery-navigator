
import React, { memo, useState, useEffect, useCallback } from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { logger } from "@/lib/logger";
import { Loader2 } from "lucide-react";
import { useArtworkImageHandler } from "@/hooks/use-artwork-image-handler";
import type { ArtworkImage as DbArtworkImage } from "@/hooks/use-artwork-images"; // Assuming this type definition exists

interface OptimizedArtworkImageProps {
  // Pass the full artwork image record from the database, or relevant parts
  imageRecord: DbArtworkImage | null | undefined; 
  title: string;
  onClick: () => void;
  className?: string; // Used to determine if it's list view (simple img) or card view
  // sizes prop is less relevant now as Cloudinary URLs are pre-defined, but kept for API compatibility.
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
  // sizes 
}: OptimizedArtworkImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  // currentDisplayUrl is the URL that will be passed to the <img> src attribute.
  // It's managed by useArtworkImageHandler now.
  // const [currentDisplayUrl, setCurrentDisplayUrl] = useState<string>("/placeholder.svg"); // OLD

  const isListView = !!className; // If className is present, assume list view (simple img)

  // Determine which Cloudinary URL to use based on context (list vs. card/detail)
  // and the type of image for caching.
  const displayUrl = isListView 
    ? imageRecord?.thumbnail_url || imageRecord?.medium_url // Prefer thumbnail for list view
    : imageRecord?.medium_url || imageRecord?.image_url;   // Prefer medium for card/detail view
  
  const imageTypeForCacheLogic = (): 'thumbnail' | 'medium' | 'full' => {
    if (isListView) {
      if (imageRecord?.thumbnail_url) return 'thumbnail';
    }
    if (imageRecord?.medium_url) return 'medium';
    return 'full'; // Fallback if only full image_url is available
  };
  const imageTypeForCache = imageTypeForCacheLogic();

  const {
    determinedOptimizedUrl, // This is what <img> src should use
    initialCachedPreviewUrl,  // For quick display if available
    cacheLoadedImage,
  } = useArtworkImageHandler({ 
    displayImageUrl: displayUrl || null, 
    // Use artwork_images.id as a stable cache key.
    // Original Supabase URL could also work if imageRecord.image_url was guaranteed to be it before Cloudinary overwrite.
    // If imageRecord.id is the DB primary key for artwork_images, it's perfect.
    cacheKey: imageRecord?.id || null, 
    imageTypeForCache: imageTypeForCache,
    title,
  });

  // currentDisplayUrl is now determinedOptimizedUrl from the hook
  const currentDisplayUrl = determinedOptimizedUrl;

  useEffect(() => {
    // Loading state should be true if currentDisplayUrl is not a data URL (i.e., network request needed)
    // and not the placeholder, unless it IS the placeholder and we are not expecting anything else.
    if (currentDisplayUrl && !currentDisplayUrl.startsWith("data:") && currentDisplayUrl !== "/placeholder.svg") {
      setIsLoading(true);
    } else {
      setIsLoading(false); // Already cached or placeholder
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
    // The hook itself will default to placeholder if displayImageUrl is null or fails.
    // No need to manually set to placeholder here if the hook handles it.
  }, [currentDisplayUrl]);
  
  // If no image record or no suitable URL determined by the hook (it defaults to placeholder)
  if (!imageRecord || currentDisplayUrl === "/placeholder.svg" && !initialCachedPreviewUrl) {
     // Render a placeholder if no image data or final URL is placeholder
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
                style={{ aspectRatio: '1 / 1', width: '100%', height: 'auto', contain: 'layout' }} // Example for list view
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


  if (isListView) { // List view (simple img tag)
    return (
      <img
        src={initialCachedPreviewUrl || currentDisplayUrl} // Show cached preview first
        alt={title}
        className={className} // className itself defines it as list view
        onClick={handleClick}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
        decoding="async"
        style={{ 
          opacity: isLoading && !initialCachedPreviewUrl ? 0 : 1, // Hide if loading network and no preview
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
        minHeight: '200px', // Ensure minimum height
        willChange: 'transform'
      }}
    >
      <AspectRatio ratio={4/3}>
        {/* Initial cached preview (could be thumbnail) shown underneath main image while it loads */}
        {initialCachedPreviewUrl && (
            <img 
              src={initialCachedPreviewUrl}
              alt={`Preview for ${title}`}
              className="absolute inset-0 h-full w-full object-cover opacity-70 blur-sm"
              aria-hidden="true"
              style={{ contain: 'layout' }}
            />
          )}
        
        {/* Loading spinner, shown if no initial preview and main image is loading */}
        {isLoading && !initialCachedPreviewUrl && currentDisplayUrl !== "/placeholder.svg" && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/40">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          )}
        
        {/* Main image */}
        <img
          src={currentDisplayUrl} // This will be the network URL or a dataURL from cache
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

