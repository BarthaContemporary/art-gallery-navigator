
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
  const [loadingState, setLoadingState] = useState<{
    isLoading: boolean;
    hasError: boolean;
    currentUrl: string | null;
    urlIndex: number;
  }>({
    isLoading: true,
    hasError: false,
    currentUrl: null,
    urlIndex: 0
  });

  const [availableUrls, setAvailableUrls] = useState<string[]>([]);

  // Get priority-ordered URLs when imageRecord changes
  useEffect(() => {
    if (!imageRecord) {
      setAvailableUrls([]);
      setLoadingState({
        isLoading: false,
        hasError: true,
        currentUrl: null,
        urlIndex: 0
      });
      return;
    }

    const urls = getPriorityOrderedUrls(imageRecord);
    console.log(`[${title}] Available URLs:`, urls);
    
    setAvailableUrls(urls);
    
    if (urls.length > 0) {
      setLoadingState({
        isLoading: true,
        hasError: false,
        currentUrl: urls[0],
        urlIndex: 0
      });
      console.log(`[${title}] Starting with URL: ${urls[0]}`);
    } else {
      console.warn(`[${title}] No valid URLs found`);
      setLoadingState({
        isLoading: false,
        hasError: true,
        currentUrl: null,
        urlIndex: 0
      });
    }
  }, [imageRecord, title]);

  const handleImageLoad = useCallback(() => {
    console.log(`[${title}] ✅ Image loaded successfully: ${loadingState.currentUrl}`);
    setLoadingState(prev => ({
      ...prev,
      isLoading: false,
      hasError: false
    }));
    onLoadingComplete?.();
  }, [title, loadingState.currentUrl, onLoadingComplete]);

  const handleImageError = useCallback(() => {
    console.error(`[${title}] ❌ Image failed to load: ${loadingState.currentUrl}`);
    
    const nextIndex = loadingState.urlIndex + 1;
    if (nextIndex < availableUrls.length) {
      const nextUrl = availableUrls[nextIndex];
      console.log(`[${title}] 🔄 Trying fallback URL ${nextIndex + 1}/${availableUrls.length}: ${nextUrl}`);
      
      setLoadingState({
        isLoading: true,
        hasError: false,
        currentUrl: nextUrl,
        urlIndex: nextIndex
      });
    } else {
      console.error(`[${title}] 💥 All URLs failed. Tried: ${availableUrls.join(', ')}`);
      setLoadingState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true
      }));
      onLoadingComplete?.();
    }
  }, [title, loadingState.currentUrl, loadingState.urlIndex, availableUrls, onLoadingComplete]);

  const handleLoadStart = useCallback(() => {
    console.log(`[${title}] 🔄 Loading started: ${loadingState.currentUrl}`);
    onLoadingStart?.();
  }, [title, loadingState.currentUrl, onLoadingStart]);

  // Show error state if no valid URLs or all failed
  if (!loadingState.currentUrl || (loadingState.hasError && loadingState.urlIndex >= availableUrls.length)) {
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
        src={loadingState.currentUrl}
        alt={title}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          loadingState.isLoading ? "opacity-0" : "opacity-100"
        )}
        onLoadStart={handleLoadStart}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
        decoding="async"
      />
      
      {/* Loading State */}
      {loadingState.isLoading && (
        <div className="absolute inset-0 bg-muted/20 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
        </div>
      )}
    </div>
  );
}
