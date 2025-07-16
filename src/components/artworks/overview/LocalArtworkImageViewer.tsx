import React, { useEffect } from "react";
import { useImageCacheManager } from "@/hooks/use-image-cache-manager";
import { useOptimizedImage } from "@/hooks/use-optimized-image";
import { LazyImage } from "@/components/ui/lazy-image";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

interface LocalArtworkImageViewerProps {
  artworkId: string;
  artworkTitle: string;
  imageUrl?: string;
  className?: string;
}

export function LocalArtworkImageViewer({ 
  artworkId, 
  artworkTitle, 
  imageUrl = "/placeholder.svg",
  className 
}: LocalArtworkImageViewerProps) {
  const { prefetchImages } = useImageCacheManager();
  
  const {
    currentImageUrl,
    currentTier,
    isLoading,
    error,
    blurDataUrl,
    upgradeToTier,
    canUpgrade
  } = useOptimizedImage({
    originalUrl: imageUrl,
    title: artworkTitle
  });

  // Prefetch higher quality images on hover
  const handleMouseEnter = () => {
    if (canUpgrade.toMedium) {
      upgradeToTier('medium');
    }
  };

  const handleClick = () => {
    if (canUpgrade.toFull) {
      upgradeToTier('full');
    }
  };

  // Preload similar images for better navigation experience
  useEffect(() => {
    if (imageUrl && imageUrl !== "/placeholder.svg") {
      // This would typically be called with related artwork images
      prefetchImages([imageUrl], 'thumbnail');
    }
  }, [imageUrl, prefetchImages]);

  if (error) {
    logger.error(`Error loading artwork image for ${artworkTitle}:`, error);
    return (
      <div className={cn(
        "flex items-center justify-center bg-muted rounded-lg",
        "min-h-[200px] text-muted-foreground",
        className
      )}>
        <div className="text-center">
          <p className="text-sm">Failed to load image</p>
          <p className="text-xs mt-1">{artworkTitle}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative group", className)}>
      <LazyImage
        src={currentImageUrl}
        alt={artworkTitle}
        className="w-full h-full object-cover rounded-lg transition-all duration-300 group-hover:scale-105"
        placeholderClassName="bg-muted animate-pulse"
        onMouseEnter={handleMouseEnter}
        onClick={handleClick}
        style={{
          backgroundImage: blurDataUrl ? `url(${blurDataUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      
      {/* Quality indicator */}
      {currentTier && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs bg-black/70 text-white px-2 py-1 rounded">
            {currentTier}
          </span>
        </div>
      )}
    </div>
  );
}