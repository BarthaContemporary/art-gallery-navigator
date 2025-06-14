
import React, { useState, useCallback } from "react";
import type { ArtworkImage } from "@/hooks/use-artworks";
import { useArtworkImageHandler } from "@/hooks/use-artwork-image-handler";
import { cn } from "@/lib/utils";

interface OptimizedArtworkImageProps {
  imageRecord?: ArtworkImage;
  title: string;
  onClick?: () => void;
  className?: string;
  sizes?: {
    thumbnail?: { width: number; height: number; quality?: number };
    medium?: { width: number; height: number; quality?: number };
    full?: { width: number; height: number; quality?: number };
  };
  priority?: number;
  tier?: 'thumbnail' | 'medium' | 'full';
}

export function OptimizedArtworkImage({
  imageRecord,
  title,
  onClick,
  className = "",
  tier = 'medium',
}: OptimizedArtworkImageProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Display URL logic: prefer medium_url, fallback to image_url, fallback to placeholder
  const displayImageUrl = imageRecord?.medium_url || imageRecord?.image_url || "/placeholder.svg";
  const cacheKey = imageRecord?.id || null;

  const { determinedOptimizedUrl, cacheLoadedImage } = useArtworkImageHandler({
    displayImageUrl,
    cacheKey,
    imageTypeForCache: tier,
    title,
  });

  const handleImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    setImageLoaded(true);
    setImageError(false);

    if (event.currentTarget.src && event.currentTarget.src !== "/placeholder.svg") {
      cacheLoadedImage(event.currentTarget.src);
    }
  }, [cacheLoadedImage]);

  const handleImageError = useCallback(() => {
    setImageError(true);
    setImageLoaded(true);
  }, []);

  const handleClick = useCallback(() => {
    if (onClick) onClick();
  }, [onClick]);

  return (
    <div 
      className={cn(
        "relative w-full h-full bg-muted/10 overflow-hidden",
        onClick && "cursor-pointer",
        className
      )}
      onClick={handleClick}
      style={{ contain: 'layout size' }}
    >
      <img
        src={determinedOptimizedUrl || "/placeholder.svg"}
        alt={title}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          imageLoaded && !imageError ? "opacity-100" : "opacity-0"
        )}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
        decoding="async"
        style={{
          objectFit: 'cover',
          width: '100%',
          height: '100%'
        }}
      />
      {!imageLoaded && (
        <div className="absolute inset-0 bg-muted/20 animate-pulse flex items-center justify-center">
          <div className="w-8 h-8 bg-muted/40 rounded"></div>
        </div>
      )}
      {imageError && (
        <div className="absolute inset-0 bg-muted/30 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <div className="w-8 h-8 bg-muted/60 rounded mx-auto mb-2"></div>
            <p className="text-xs">Image unavailable</p>
          </div>
        </div>
      )}
    </div>
  );
}
