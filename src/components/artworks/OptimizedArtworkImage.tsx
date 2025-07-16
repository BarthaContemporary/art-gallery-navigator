
import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Loader2, ImageOff } from "lucide-react";
import { logger } from "@/lib/logger";
import { useOptimizedImage } from "@/hooks/use-optimized-image";
import type { ImageRecord } from "@/utils/image-url-resolver";

interface OptimizedArtworkImageProps {
  imageRecord?: ImageRecord;
  title: string;
  onClick?: () => void;
  className?: string;
  tier?: 'thumbnail' | 'medium' | 'full';
  onLoadingStart?: () => void;
  onLoadingComplete?: () => void;
}

export function OptimizedArtworkImage({
  imageRecord,
  title,
  onClick,
  className,
  tier = 'medium',
  onLoadingStart,
  onLoadingComplete
}: OptimizedArtworkImageProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Use the optimized image hook if we have a valid image URL
  const originalUrl = imageRecord?.image_url || imageRecord?.thumbnail_url || imageRecord?.medium_url;
  
  // Early return for no image case
  if (!originalUrl) {
    return (
      <div 
        className={cn(
          "relative w-full h-full bg-muted/10 overflow-hidden flex items-center justify-center",
          onClick && "cursor-pointer",
          className
        )}
        onClick={onClick}
      >
        <div className="text-center text-muted-foreground">
          <ImageOff className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
          <p className="text-xs">No Image Available</p>
        </div>
      </div>
    );
  }
  
  const {
    currentImageUrl,
    isLoading,
    error,
    blurDataUrl,
    upgradeToTier
  } = useOptimizedImage({
    originalUrl: originalUrl
  });

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    onLoadingComplete?.();
  }, [onLoadingComplete]);

  const handleImageError = useCallback(() => {
    logger.error(`[OptimizedArtworkImage] Image load error: ${title} - ${currentImageUrl}`);
    onLoadingComplete?.();
  }, [title, currentImageUrl, onLoadingComplete]);

  const handleMouseEnter = useCallback(() => {
    if (tier === 'thumbnail') {
      upgradeToTier('medium');
    }
  }, [tier, upgradeToTier]);

  const handleClick = useCallback(() => {
    if (tier !== 'full') {
      upgradeToTier('full');
    }
    onClick?.();
  }, [tier, upgradeToTier, onClick]);

  // Call loading start when component starts loading
  React.useEffect(() => {
    if (isLoading) {
      onLoadingStart?.();
    }
  }, [isLoading, onLoadingStart]);

  // Error state
  if (error) {
    return (
      <div 
        className={cn(
          "relative w-full h-full bg-muted/10 overflow-hidden flex items-center justify-center",
          onClick && "cursor-pointer",
          className
        )}
        onClick={onClick}
      >
        <div className="text-center text-muted-foreground">
          <ImageOff className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
          <p className="text-xs">No Image Available</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "relative w-full h-full bg-muted/10 overflow-hidden",
        onClick && "cursor-pointer",
        className
      )}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
    >
      {/* Blur placeholder */}
      {blurDataUrl && !imageLoaded && (
        <img
          src={blurDataUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-50 blur-sm"
          aria-hidden="true"
        />
      )}
      
      {/* Main image */}
      <img
        src={currentImageUrl}
        alt={title}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          imageLoaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
        decoding="async"
      />
      
      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 bg-muted/20 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
        </div>
      )}
    </div>
  );
}
