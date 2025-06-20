
import React, { useState, useCallback, useRef, useEffect } from "react";
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
  tier?: 'thumbnail' | 'medium' | 'full';
  onLoadingStart?: () => void;
  onLoadingComplete?: () => void;
}

export function OptimizedArtworkImage({
  imageRecord,
  title,
  onClick,
  className = "",
  tier = 'medium',
  onLoadingStart,
  onLoadingComplete,
}: OptimizedArtworkImageProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const loadingStartedRef = useRef(false);

  // Get the appropriate image URL based on tier
  const getImageUrl = useCallback(() => {
    if (!imageRecord) return null;
    
    switch (tier) {
      case 'thumbnail':
        return imageRecord.thumbnail_url || imageRecord.medium_url || imageRecord.image_url;
      case 'full':
        return imageRecord.image_url || imageRecord.medium_url || imageRecord.thumbnail_url;
      case 'medium':
      default:
        return imageRecord.medium_url || imageRecord.image_url || imageRecord.thumbnail_url;
    }
  }, [imageRecord, tier]);

  const imageUrl = getImageUrl();
  const cacheKey = imageRecord?.id || null;

  const { determinedOptimizedUrl, cacheLoadedImage } = useArtworkImageHandler({
    displayImageUrl: imageUrl || "/placeholder.svg",
    cacheKey,
    imageTypeForCache: tier,
    title,
  });

  // Reset states when image changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
    setRetryCount(0);
    setIsRetrying(false);
    loadingStartedRef.current = false;
  }, [determinedOptimizedUrl, imageRecord?.id]);

  const handleImageLoadStart = useCallback(() => {
    if (!loadingStartedRef.current) {
      loadingStartedRef.current = true;
      onLoadingStart?.();
    }
  }, [onLoadingStart]);

  const handleImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    console.log(`Image loaded successfully: ${title} from ${event.currentTarget.src}`);
    setImageLoaded(true);
    setImageError(false);
    setIsRetrying(false);
    onLoadingComplete?.();

    if (event.currentTarget.src && event.currentTarget.src !== "/placeholder.svg") {
      cacheLoadedImage(event.currentTarget.src);
    }
  }, [cacheLoadedImage, title, onLoadingComplete]);

  const handleImageError = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const failedUrl = event.currentTarget.src;
    console.error(`Image failed to load: ${title} from ${failedUrl}`);
    setImageError(true);
    setImageLoaded(true);
    setIsRetrying(false);
    onLoadingComplete?.();
  }, [title, onLoadingComplete]);

  const handleRetry = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    console.log(`Retrying image load for: ${title} (retry ${retryCount + 1})`);
    
    setImageError(false);
    setImageLoaded(false);
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    loadingStartedRef.current = false;
    
    // Trigger loading start callback for retry
    setTimeout(() => {
      onLoadingStart?.();
    }, 0);
  }, [title, retryCount, onLoadingStart]);

  const handleClick = useCallback(() => {
    if (onClick) onClick();
  }, [onClick]);

  if (!imageRecord) {
    return (
      <div 
        className={cn(
          "relative w-full h-full bg-muted/10 overflow-hidden flex items-center justify-center",
          onClick && "cursor-pointer",
          className
        )}
        onClick={handleClick}
      >
        <div className="text-center text-muted-foreground">
          <ImageOff className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
          <p className="text-xs">No Image</p>
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
    >
      <img
        src={determinedOptimizedUrl || "/placeholder.svg"}
        alt={title}
        className={cn(
          "w-full h-full object-contain transition-opacity duration-300",
          imageLoaded && !imageError ? "opacity-100" : "opacity-0"
        )}
        onLoadStart={handleImageLoadStart}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
        decoding="async"
        data-loading={!imageLoaded}
      />
      
      {/* Loading State */}
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
      
      {/* Error State with Retry */}
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
      
      {/* Status indicators */}
      {determinedOptimizedUrl?.includes('res.cloudinary.com') && (
        <div className="absolute top-1 right-1 bg-green-500/80 text-white text-xs px-1 rounded opacity-70">
          CDN
        </div>
      )}
      {imageRecord.is_primary && (
        <div className="absolute bottom-1 left-1 bg-blue-500/80 text-white text-xs px-1 rounded opacity-70">
          PRIMARY
        </div>
      )}
    </div>
  );
}
