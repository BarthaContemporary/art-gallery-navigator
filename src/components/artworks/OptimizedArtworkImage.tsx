
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

  // Get the appropriate image URL based on tier
  const getImageUrl = useCallback(() => {
    if (!imageRecord) return null;
    
    console.log(`Getting image URL for tier ${tier}:`, imageRecord);
    
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

  const handleImageLoad = useCallback(() => {
    console.log(`Image loaded successfully for: ${title}`);
    setIsLoading(false);
    setHasError(false);
    onLoadingComplete?.();
  }, [onLoadingComplete, title]);

  const handleImageError = useCallback(() => {
    console.error(`Image failed to load for: ${title}`, imageUrl);
    setIsLoading(false);
    setHasError(true);
    onLoadingComplete?.();
  }, [onLoadingComplete, title, imageUrl]);

  const handleLoadStart = useCallback(() => {
    console.log(`Image load started for: ${title}`);
    setIsLoading(true);
    setHasError(false);
    onLoadingStart?.();
  }, [onLoadingStart, title]);

  if (!imageRecord || !imageUrl) {
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
      onClick={onClick}
    >
      <img
        src={imageUrl}
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
            <p className="text-xs">Image unavailable</p>
          </div>
        </div>
      )}
      
      {/* CDN indicator */}
      {imageUrl?.includes('res.cloudinary.com') && (
        <div className="absolute top-1 right-1 bg-green-500/80 text-white text-xs px-1 rounded opacity-70">
          CDN
        </div>
      )}
    </div>
  );
}
