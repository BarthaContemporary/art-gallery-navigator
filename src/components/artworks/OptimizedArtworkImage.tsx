
import React, { useState, useCallback, useRef } from "react";
import type { ArtworkImage } from "@/hooks/use-artworks";
import { useArtworkImageHandler } from "@/hooks/use-artwork-image-handler";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getImageFallbackChain, fixCloudinaryUrl } from "@/hooks/use-optimized-image/url-generator";

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
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [attemptedAutoFix, setAttemptedAutoFix] = useState(false);
  const fallbackChainRef = useRef<string[]>([]);

  // Create enhanced fallback chain with all available URLs
  const primaryUrl = tier === 'thumbnail' ? imageRecord?.thumbnail_url : imageRecord?.medium_url;
  const fallbackUrl = imageRecord?.image_url;
  
  if (fallbackChainRef.current.length === 0 && imageRecord) {
    // Create a comprehensive fallback chain including all URL variants
    const allUrls = [
      imageRecord.thumbnail_url,
      imageRecord.medium_url,
      imageRecord.image_url
    ].filter(Boolean);
    
    fallbackChainRef.current = getImageFallbackChain(primaryUrl, fallbackUrl);
    
    // Add any missing URLs from the imageRecord to the fallback chain
    allUrls.forEach(url => {
      if (url && !fallbackChainRef.current.includes(url)) {
        fallbackChainRef.current.push(url);
      }
    });
    
    console.log(`Created fallback chain for ${title}:`, fallbackChainRef.current);
  }

  const currentImageUrl = fallbackChainRef.current[currentUrlIndex] || "/placeholder.svg";
  const cacheKey = imageRecord?.id || null;

  const { determinedOptimizedUrl, cacheLoadedImage } = useArtworkImageHandler({
    displayImageUrl: currentImageUrl,
    cacheKey,
    imageTypeForCache: tier,
    title,
  });

  const isPlaceholder = determinedOptimizedUrl === "/placeholder.svg" || 
    currentUrlIndex >= fallbackChainRef.current.length - 1;
  
  if (isPlaceholder && imageRecord) {
    console.log(`OptimizedArtworkImage: Using fallback for ${title}:`, {
      currentUrlIndex,
      fallbackChain: fallbackChainRef.current,
      imageRecord: {
        id: imageRecord.id,
        thumbnail_url: imageRecord.thumbnail_url,
        medium_url: imageRecord.medium_url,
        image_url: imageRecord.image_url,
        is_primary: imageRecord.is_primary,
        display_order: imageRecord.display_order
      },
      determinedOptimizedUrl
    });
  }

  const handleImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    console.log(`Image loaded successfully: ${title} from ${event.currentTarget.src}`);
    setImageLoaded(true);
    setImageError(false);
    setIsRetrying(false);

    if (event.currentTarget.src && event.currentTarget.src !== "/placeholder.svg") {
      cacheLoadedImage(event.currentTarget.src);
    }
  }, [cacheLoadedImage, title]);

  const handleImageError = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const failedUrl = event.currentTarget.src;
    console.error(`Image failed to load: ${title} from ${failedUrl}`);
    
    // Try to auto-fix Cloudinary URL if this is the first error
    if (!attemptedAutoFix && failedUrl.includes('res.cloudinary.com')) {
      const fixedUrl = fixCloudinaryUrl(failedUrl);
      if (fixedUrl !== failedUrl) {
        console.log(`Attempting auto-fix for ${title}: ${failedUrl} -> ${fixedUrl}`);
        setAttemptedAutoFix(true);
        event.currentTarget.src = fixedUrl;
        return;
      }
    }
    
    // Try next URL in fallback chain
    if (currentUrlIndex < fallbackChainRef.current.length - 1) {
      const nextUrl = fallbackChainRef.current[currentUrlIndex + 1];
      console.log(`Trying fallback URL for ${title}: ${nextUrl} (attempt ${currentUrlIndex + 2}/${fallbackChainRef.current.length})`);
      setCurrentUrlIndex(prev => prev + 1);
      setImageLoaded(false);
      setImageError(false);
      setAttemptedAutoFix(false);
      return;
    }
    
    // All URLs failed
    console.error(`All image URLs failed for ${title}. Attempted URLs:`, fallbackChainRef.current);
    setImageError(true);
    setImageLoaded(true);
    setIsRetrying(false);
  }, [title, currentUrlIndex, attemptedAutoFix]);

  const handleRetry = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    console.log(`Retrying image load for: ${title} (retry ${retryCount + 1})`);
    
    // Reset to first URL in chain and clear auto-fix attempt
    setCurrentUrlIndex(0);
    setImageError(false);
    setImageLoaded(false);
    setIsRetrying(true);
    setAttemptedAutoFix(false);
    setRetryCount(prev => prev + 1);
  }, [title, retryCount]);

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
      
      {/* Loading State */}
      {!imageLoaded && !imageError && (
        <div className="absolute inset-0 bg-muted/20 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
            {isRetrying && (
              <span className="text-xs text-muted-foreground">Retrying...</span>
            )}
            {currentUrlIndex > 0 && (
              <span className="text-xs text-muted-foreground">
                Fallback {currentUrlIndex + 1}/{fallbackChainRef.current.length}
              </span>
            )}
            {attemptedAutoFix && (
              <span className="text-xs text-muted-foreground">Auto-fixing URL...</span>
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
            <p className="text-xs mb-3 text-muted-foreground/70">
              Failed: {fallbackChainRef.current.length} URLs
            </p>
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
      {!isPlaceholder && determinedOptimizedUrl?.includes('res.cloudinary.com') && (
        <div className="absolute top-1 right-1 bg-green-500/80 text-white text-xs px-1 rounded opacity-70">
          CDN
        </div>
      )}
      {attemptedAutoFix && (
        <div className="absolute top-1 left-1 bg-orange-500/80 text-white text-xs px-1 rounded opacity-70">
          FIXED
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
