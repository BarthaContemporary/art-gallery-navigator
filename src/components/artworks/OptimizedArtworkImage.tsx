
import React, { useState, useEffect, useCallback } from "react";
import type { ArtworkImage } from "@/hooks/use-artworks";
import { cn } from "@/lib/utils";
import { Loader2, ImageOff } from "lucide-react";
import { getPriorityOrderedUrls } from "@/utils/image-url-utils";

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
  const [urlIndex, setUrlIndex] = useState(0);
  const [availableUrls, setAvailableUrls] = useState<string[]>([]);

  // Get priority-ordered URLs when imageRecord changes
  useEffect(() => {
    if (!imageRecord) {
      setAvailableUrls([]);
      setCurrentSrc(null);
      setIsLoading(false);
      setHasError(true);
      return;
    }

    const urls = getPriorityOrderedUrls(imageRecord);
    console.log(`[${title}] Available URLs in priority order:`, urls);
    
    setAvailableUrls(urls);
    setUrlIndex(0);
    
    if (urls.length > 0) {
      setCurrentSrc(urls[0]);
      setIsLoading(true);
      setHasError(false);
      console.log(`[${title}] Starting with URL: ${urls[0]}`);
    } else {
      console.warn(`[${title}] No valid URLs found`);
      setCurrentSrc(null);
      setIsLoading(false);
      setHasError(true);
    }
  }, [imageRecord, title]);

  const handleImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    console.log(`[${title}] ✅ Image loaded successfully: ${currentSrc}`);
    setIsLoading(false);
    setHasError(false);
    onLoadingComplete?.();
  }, [title, currentSrc, onLoadingComplete]);

  const handleImageError = useCallback(() => {
    console.error(`[${title}] ❌ Image failed to load: ${currentSrc}`);
    
    const nextIndex = urlIndex + 1;
    if (nextIndex < availableUrls.length) {
      const nextUrl = availableUrls[nextIndex];
      console.log(`[${title}] 🔄 Trying fallback URL ${nextIndex + 1}/${availableUrls.length}: ${nextUrl}`);
      
      setUrlIndex(nextIndex);
      setCurrentSrc(nextUrl);
      setIsLoading(true);
      setHasError(false);
    } else {
      console.error(`[${title}] 💥 All URLs failed. Tried: ${availableUrls.join(', ')}`);
      setIsLoading(false);
      setHasError(true);
      onLoadingComplete?.();
    }
  }, [title, currentSrc, urlIndex, availableUrls, onLoadingComplete]);

  const handleLoadStart = useCallback(() => {
    console.log(`[${title}] 🔄 Loading started: ${currentSrc}`);
    setIsLoading(true);
    setHasError(false);
    onLoadingStart?.();
  }, [title, currentSrc, onLoadingStart]);

  // Show error state if no valid URLs or all failed
  if (!currentSrc || (hasError && urlIndex >= availableUrls.length)) {
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
          "w-full h-full transition-opacity duration-300 object-cover",
          isLoading ? "opacity-0" : "opacity-100"
        )}
        onLoadStart={handleLoadStart}
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
