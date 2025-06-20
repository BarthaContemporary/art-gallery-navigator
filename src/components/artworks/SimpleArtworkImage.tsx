
import React, { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Loader2, ImageOff } from "lucide-react";
import { logger } from "@/lib/logger";
import { ImageUrlResolver, type ImageRecord } from "@/utils/image-url-resolver";

interface SimpleArtworkImageProps {
  imageRecord?: ImageRecord;
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
  const [resolvedUrl, setResolvedUrl] = useState<string>('/placeholder.svg');

  // Resolve the best available URL when component mounts or imageRecord changes
  useEffect(() => {
    let isMounted = true;

    async function resolveImageUrl() {
      if (!imageRecord) {
        setResolvedUrl('/placeholder.svg');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setHasError(false);

      try {
        const bestUrl = await ImageUrlResolver.getBestValidUrl(imageRecord, size);
        
        if (isMounted) {
          setResolvedUrl(bestUrl);
          
          // If we got a real URL, preload it to ensure it works
          if (bestUrl !== '/placeholder.svg') {
            const isValidImage = await ImageUrlResolver.preloadImage(bestUrl);
            if (isMounted) {
              if (!isValidImage) {
                logger.warn(`[SimpleArtworkImage] Preload failed for resolved URL: ${bestUrl}`);
                setResolvedUrl('/placeholder.svg');
                setHasError(true);
              }
              setIsLoading(false);
            }
          } else {
            setIsLoading(false);
            setHasError(true);
          }
        }
      } catch (error) {
        logger.error(`[SimpleArtworkImage] Error resolving URL for ${title}:`, error);
        if (isMounted) {
          setResolvedUrl('/placeholder.svg');
          setHasError(true);
          setIsLoading(false);
        }
      }
    }

    resolveImageUrl();

    return () => {
      isMounted = false;
    };
  }, [imageRecord, size, title]);

  const handleImageLoad = useCallback(() => {
    logger.log(`[SimpleArtworkImage] Image loaded successfully: ${title}`);
    setIsLoading(false);
    setHasError(false);
  }, [title]);

  const handleImageError = useCallback(() => {
    logger.error(`[SimpleArtworkImage] Image load error: ${title} - ${resolvedUrl}`);
    setHasError(true);
    setIsLoading(false);
    
    // If this wasn't already the placeholder, try to fall back to it
    if (resolvedUrl !== '/placeholder.svg') {
      setResolvedUrl('/placeholder.svg');
    }
  }, [title, resolvedUrl]);

  // Error state
  if (hasError && resolvedUrl === '/placeholder.svg') {
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
        src={resolvedUrl}
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
