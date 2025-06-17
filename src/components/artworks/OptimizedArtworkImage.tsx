
import React, { useState, useCallback } from "react";
import type { ArtworkImage } from "@/hooks/use-artworks";
import { useArtworkImageHandler } from "@/hooks/use-artwork-image-handler";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // Display URL logic: prefer medium_url, fallback to image_url, fallback to placeholder
  const displayImageUrl = imageRecord?.medium_url || imageRecord?.image_url || "/placeholder.svg";
  const cacheKey = imageRecord?.id || null;

  const { determinedOptimizedUrl, cacheLoadedImage } = useArtworkImageHandler({
    displayImageUrl,
    cacheKey,
    imageTypeForCache: tier,
    title,
  });

  // Add debug logging for fallback URLs
  const isPlaceholder = determinedOptimizedUrl === "/placeholder.svg" || 
    (determinedOptimizedUrl && determinedOptimizedUrl.includes('fallback-'));
  
  if (isPlaceholder) {
    console.log(`OptimizedArtworkImage: Using placeholder/fallback for ${title}:`, {
      imageRecord,
      displayImageUrl,
      determinedOptimizedUrl,
      cacheKey
    });
  }

  const handleImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    console.log(`Image loaded successfully: ${title}`, event.currentTarget.src);
    setImageLoaded(true);
    setImageError(false);
    setIsRetrying(false);

    if (event.currentTarget.src && event.currentTarget.src !== "/placeholder.svg") {
      cacheLoadedImage(event.currentTarget.src);
    }
  }, [cacheLoadedImage, title]);

  const handleImageError = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    console.error(`Image failed to load: ${title}`, event.currentTarget.src);
    setImageError(true);
    setImageLoaded(true);
    setIsRetrying(false);
  }, [title]);

  const handleRetry = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    console.log(`Retrying image load for: ${title}`, determinedOptimizedUrl);
    setImageError(false);
    setImageLoaded(false);
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    
    // Force reload by adding a cache-busting parameter
    const img = document.querySelector(`img[alt="${title}"]`) as HTMLImageElement;
    if (img && determinedOptimizedUrl) {
      const separator = determinedOptimizedUrl.includes('?') ? '&' : '?';
      img.src = `${determinedOptimizedUrl}${separator}retry=${retryCount + 1}`;
    }
  }, [determinedOptimizedUrl, title, retryCount]);

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
      
      {/* Enhanced Loading State */}
      {!imageLoaded && !imageError && (
        <div className="absolute inset-0 bg-muted/20 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
            {isRetrying && (
              <span className="text-xs text-muted-foreground">Retrying...</span>
            )}
          </div>
        </div>
      )}
      
      {/* Enhanced Error State with Retry */}
      {imageError && (
        <div className="absolute inset-0 bg-muted/30 flex items-center justify-center">
          <div className="text-center text-muted-foreground p-4">
            <ImageOff className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
            <p className="text-xs mb-3">Image unavailable</p>
            {retryCount < 3 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="text-xs h-6 px-2"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Retry
              </Button>
            )}
            {retryCount >= 3 && (
              <p className="text-xs text-muted-foreground/70">
                Max retries reached
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
