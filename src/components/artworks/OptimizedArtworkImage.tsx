
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
  const [attemptedUrls, setAttemptedUrls] = useState<string[]>([]);

  // Get available image URLs in order of preference
  const getAvailableUrls = useCallback(() => {
    if (!imageRecord) return [];
    
    const urls: string[] = [];
    
    // Based on tier, try different URLs
    switch (tier) {
      case 'thumbnail':
        if (imageRecord.thumbnail_url) urls.push(imageRecord.thumbnail_url);
        if (imageRecord.medium_url) urls.push(imageRecord.medium_url);
        if (imageRecord.image_url) urls.push(imageRecord.image_url);
        break;
      case 'full':
        if (imageRecord.image_url) urls.push(imageRecord.image_url);
        if (imageRecord.medium_url) urls.push(imageRecord.medium_url);
        if (imageRecord.thumbnail_url) urls.push(imageRecord.thumbnail_url);
        break;
      case 'medium':
      default:
        if (imageRecord.medium_url) urls.push(imageRecord.medium_url);
        if (imageRecord.image_url) urls.push(imageRecord.image_url);
        if (imageRecord.thumbnail_url) urls.push(imageRecord.thumbnail_url);
        break;
    }

    // Filter out invalid URLs
    return urls.filter(url => 
      url && 
      url !== "/placeholder.svg" && 
      url.trim() !== "" &&
      (url.startsWith('http') || url.startsWith('data:'))
    );
  }, [imageRecord, tier]);

  // Initialize with first available URL
  React.useEffect(() => {
    const availableUrls = getAvailableUrls();
    setAttemptedUrls([]);
    
    if (availableUrls.length > 0) {
      const firstUrl = availableUrls[0];
      setCurrentSrc(firstUrl);
      setHasError(false);
      setIsLoading(true);
      console.log(`Loading image for ${title}: ${firstUrl}`);
    } else {
      console.log(`No valid image URLs for ${title}`);
      setCurrentSrc(null);
      setIsLoading(false);
      setHasError(true);
    }
  }, [getAvailableUrls, title]);

  const handleImageLoad = useCallback(() => {
    console.log(`Image loaded successfully for: ${title} - ${currentSrc}`);
    setIsLoading(false);
    setHasError(false);
    onLoadingComplete?.();
  }, [onLoadingComplete, title, currentSrc]);

  const handleImageError = useCallback(() => {
    console.error(`Image failed to load for: ${title} - ${currentSrc}`);
    
    const availableUrls = getAvailableUrls();
    const newAttemptedUrls = [...attemptedUrls, currentSrc].filter(Boolean);
    setAttemptedUrls(newAttemptedUrls);

    // Find next URL that hasn't been tried
    const nextUrl = availableUrls.find(url => !newAttemptedUrls.includes(url));
    
    if (nextUrl) {
      console.log(`Trying fallback URL for ${title}: ${nextUrl}`);
      setCurrentSrc(nextUrl);
      setIsLoading(true);
      setHasError(false);
    } else {
      console.error(`All URLs failed for ${title}. Attempted: ${newAttemptedUrls.join(', ')}`);
      setIsLoading(false);
      setHasError(true);
      onLoadingComplete?.();
    }
  }, [onLoadingComplete, title, currentSrc, attemptedUrls, getAvailableUrls]);

  const handleLoadStart = useCallback(() => {
    console.log(`Image load started for: ${title} - ${currentSrc}`);
    setIsLoading(true);
    setHasError(false);
    onLoadingStart?.();
  }, [onLoadingStart, title, currentSrc]);

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
