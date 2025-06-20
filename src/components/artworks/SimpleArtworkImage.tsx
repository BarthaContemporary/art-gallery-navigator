
import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Loader2, ImageOff } from "lucide-react";
import { logger } from "@/lib/logger";

interface SimpleArtworkImageProps {
  imageRecord?: {
    id: string;
    image_url: string;
    thumbnail_url?: string | null;
    medium_url?: string | null;
    processed?: boolean;
  };
  title: string;
  onClick?: () => void;
  className?: string;
  size?: 'thumbnail' | 'medium' | 'full';
}

export function SimpleArtworkImage({
  imageRecord,
  title,
  onClick,
  className = "",
  size = 'medium'
}: SimpleArtworkImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string>(() => {
    if (!imageRecord) return '/placeholder.svg';
    
    // Simple priority: processed URLs first, then original
    if (size === 'thumbnail' && imageRecord.thumbnail_url) {
      return imageRecord.thumbnail_url;
    }
    if (size === 'medium' && imageRecord.medium_url) {
      return imageRecord.medium_url;
    }
    if (imageRecord.image_url) {
      return imageRecord.image_url;
    }
    return '/placeholder.svg';
  });

  const handleImageLoad = useCallback(() => {
    logger.log(`[SimpleArtworkImage] Loaded: ${title}`);
    setIsLoading(false);
    setHasError(false);
  }, [title]);

  const handleImageError = useCallback(() => {
    logger.error(`[SimpleArtworkImage] Error loading: ${title} - ${currentUrl}`);
    setHasError(true);
    setIsLoading(false);
    
    // Simple fallback logic
    if (imageRecord) {
      if (currentUrl === imageRecord.thumbnail_url && imageRecord.medium_url) {
        setCurrentUrl(imageRecord.medium_url);
        setIsLoading(true);
        setHasError(false);
        return;
      }
      if (currentUrl !== imageRecord.image_url && imageRecord.image_url) {
        setCurrentUrl(imageRecord.image_url);
        setIsLoading(true);
        setHasError(false);
        return;
      }
    }
    
    // Final fallback
    setCurrentUrl('/placeholder.svg');
  }, [title, currentUrl, imageRecord]);

  // Error state
  if (hasError && currentUrl === '/placeholder.svg') {
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
        src={currentUrl}
        alt={title}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100"
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
