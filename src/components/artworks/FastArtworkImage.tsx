import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";
import type { ImageRecord } from "@/utils/image-url-resolver";

interface FastArtworkImageProps {
  imageRecord?: ImageRecord;
  title: string;
  onClick?: () => void;
  className?: string;
  tier?: 'thumbnail' | 'medium' | 'full';
}

export function FastArtworkImage({
  imageRecord,
  title,
  onClick,
  className,
  tier = 'thumbnail'
}: FastArtworkImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Get the best available URL without complex validation
  const getBestImageUrl = useCallback((): string => {
    if (!imageRecord) return '/placeholder.svg';

    // Skip URLs that contain "processing" as they're invalid
    const isValidUrl = (url: string | null | undefined): boolean => {
      return url && url !== '/placeholder.svg' && !url.includes('processing');
    };

    // Priority order based on tier
    if (tier === 'thumbnail' && isValidUrl(imageRecord.thumbnail_url)) {
      return imageRecord.thumbnail_url!;
    }
    
    if (tier === 'medium' && isValidUrl(imageRecord.medium_url)) {
      return imageRecord.medium_url!;
    }
    
    // Fallback to any valid URL
    if (isValidUrl(imageRecord.image_url)) {
      return imageRecord.image_url;
    }
    
    if (isValidUrl(imageRecord.medium_url)) {
      return imageRecord.medium_url!;
    }
    
    if (isValidUrl(imageRecord.thumbnail_url)) {
      return imageRecord.thumbnail_url!;
    }

    return '/placeholder.svg';
  }, [imageRecord, tier]);

  const imageUrl = getBestImageUrl();

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  // If no valid URL or error, show placeholder
  if (imageUrl === '/placeholder.svg' || hasError) {
    return (
      <div 
        className={cn(
          "relative w-full h-full bg-muted/10 overflow-hidden flex items-center justify-center",
          onClick && "cursor-pointer hover:bg-muted/20 transition-colors",
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
          "w-full h-full object-cover transition-all duration-300",
          isLoading ? "opacity-0 scale-110" : "opacity-100 scale-100",
          onClick && "hover:scale-105"
        )}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
        decoding="async"
      />
      
      {/* Simple loading state */}
      {isLoading && (
        <div className="absolute inset-0 bg-muted/5 animate-pulse" />
      )}
    </div>
  );
}