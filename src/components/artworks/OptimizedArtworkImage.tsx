
import React, { useState, useCallback } from "react";
import type { ArtworkImage } from "@/hooks/use-artworks";
import { cn } from "@/lib/utils";
import { Loader2, ImageOff } from "lucide-react";

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
  onLoadingComplete
}: OptimizedArtworkImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);

  // Simplified image URL selection with better fallback logic
  const getImageUrl = useCallback(() => {
    if (!imageRecord) return null;
    
    console.log(`Getting image URL for tier ${tier}:`, imageRecord);
    
    // Simple tier-based selection with fallbacks
    let imageUrl: string | null = null;
    
    switch (tier) {
      case 'thumbnail':
        imageUrl = imageRecord.thumbnail_url || imageRecord.medium_url || imageRecord.image_url;
        break;
      case 'full':
        imageUrl = imageRecord.image_url || imageRecord.medium_url || imageRecord.thumbnail_url;
        break;
      case 'medium':
      default:
        imageUrl = imageRecord.medium_url || imageRecord.image_url || imageRecord.thumbnail_url;
        break;
    }

    // Validate the URL
    if (imageUrl && imageUrl !== "/placeholder.svg" && imageUrl.trim() !== "") {
      return imageUrl;
    }
    
    return null;
  }, [imageRecord, tier]);

  React.useEffect(() => {
    const url = getImageUrl();
    setCurrentSrc(url);
    setHasError(false);
    setIsLoading(!!url);
    
    if (url) {
      console.log(`Loading image for ${title}: ${url}`);
    } else {
      console.log(`No valid image URL for ${title}`);
      setIsLoading(false);
    }
  }, [getImageUrl, title]);

  const handleImageLoad = useCallback(() => {
    console.log(`Image loaded successfully for: ${title}`);
    setIsLoading(false);
    setHasError(false);
    onLoadingComplete?.();
  }, [onLoadingComplete, title]);

  const handleImageError = useCallback(() => {
    console.error(`Image failed to load for: ${title}`, currentSrc);
    setIsLoading(false);
    setHasError(true);
    onLoadingComplete?.();
    
    // Try fallback to original image_url if we were using processed versions
    if (imageRecord?.image_url && currentSrc !== imageRecord.image_url) {
      console.log(`Trying fallback URL for ${title}: ${imageRecord.image_url}`);
      setCurrentSrc(imageRecord.image_url);
      setIsLoading(true);
      setHasError(false);
    }
  }, [onLoadingComplete, title, currentSrc, imageRecord]);

  const handleLoadStart = useCallback(() => {
    console.log(`Image load started for: ${title}`);
    setIsLoading(true);
    setHasError(false);
    onLoadingStart?.();
  }, [onLoadingStart, title]);

  if (!imageRecord || !currentSrc) {
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
      onClick={onClick}
    >
      <img
        src={currentSrc}
        alt={title}
        className={cn(
          "w-full h-full object-contain transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100"
        )}
        onLoadStart={handleLoadStart}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
        decoding="async"
      />
      
      {/* Loading State */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 bg-muted/20 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
        </div>
      )}
      
      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 bg-muted/30 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <ImageOff className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
            <p className="text-xs">Failed to Load</p>
            <p className="text-xs opacity-75">{tier} quality</p>
          </div>
        </div>
      )}
    </div>
  );
}
