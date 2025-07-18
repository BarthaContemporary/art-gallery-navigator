/**
 * Phase 4: Progressive Image Loading Component
 * 
 * Shows thumbnails instantly, then upgrades to higher quality.
 * Implements proper caching strategies and preloading.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { Artwork } from "@/hooks/use-artworks";
import { ImageUrlResolver, ImageTier, ResolvedImageUrl } from "@/services/image-url-resolver";
import { cn } from "@/lib/utils";

interface ProgressiveArtworkImageProps {
  artwork: Artwork;
  finalTier?: ImageTier;
  className?: string;
  alt?: string;
  priority?: boolean;
  onClick?: () => void;
  onLoad?: () => void;
  onError?: (error: string) => void;
  preloadNext?: Artwork[];
}

export function ProgressiveArtworkImage({
  artwork,
  finalTier = 'medium',
  className,
  alt,
  priority = false,
  onClick,
  onLoad,
  onError,
  preloadNext = []
}: ProgressiveArtworkImageProps) {
  const [currentImage, setCurrentImage] = useState<ResolvedImageUrl | null>(null);
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
  const [finalLoaded, setFinalLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  // Progressive loading effect
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const loadProgressive = async () => {
      try {
        setLoading(true);
        setHasError(false);

        // Step 1: Load thumbnail immediately for instant feedback
        const thumbnailUrl = await ImageUrlResolver.resolveImageUrl(
          artwork,
          'thumbnail',
          false
        );

        if (cancelled || !mountedRef.current) return;

        setCurrentImage(thumbnailUrl);

        // Step 2: If we need a higher resolution, load it in background
        if (finalTier !== 'thumbnail') {
          const finalUrl = await ImageUrlResolver.resolveImageUrl(
            artwork,
            finalTier,
            false
          );

          if (cancelled || !mountedRef.current) return;

          // Preload the final image before switching
          if (finalUrl.source !== 'placeholder') {
            await ImageUrlResolver.preloadImage(finalUrl.url);
            
            if (cancelled || !mountedRef.current) return;
            
            setCurrentImage(finalUrl);
            setFinalLoaded(true);
          }
        } else {
          setFinalLoaded(true);
        }

        // Step 3: Preload next images if provided
        if (preloadNext.length > 0 && !cancelled && mountedRef.current) {
          preloadNext.slice(0, 3).forEach(async (nextArtwork) => {
            try {
              const nextUrl = await ImageUrlResolver.resolveImageUrl(
                nextArtwork,
                'thumbnail',
                false
              );
              if (nextUrl.source !== 'placeholder') {
                ImageUrlResolver.preloadImage(nextUrl.url);
              }
            } catch (error) {
              console.debug('Preload failed for next image:', error);
            }
          });
        }

      } catch (error) {
        console.error('Progressive loading failed:', error);
        if (!cancelled && mountedRef.current) {
          setHasError(true);
          onError?.(error instanceof Error ? error.message : 'Failed to load image');
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setLoading(false);
        }
      }
    };

    loadProgressive();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [artwork.id, finalTier, preloadNext]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleImageLoad = useCallback(() => {
    if (!mountedRef.current) return;
    
    if (currentImage?.tier === 'thumbnail') {
      setThumbnailLoaded(true);
    }
    
    if (finalLoaded) {
      setLoading(false);
      onLoad?.();
    }
  }, [currentImage?.tier, finalLoaded, onLoad]);

  const handleImageError = useCallback(() => {
    if (!mountedRef.current) return;
    
    setHasError(true);
    setLoading(false);
    onError?.('Image failed to load');
  }, [onError]);

  // Show placeholder if no image or error
  if (!currentImage || hasError || currentImage.source === 'placeholder') {
    return (
      <div 
        className={cn(
          "w-full h-full bg-muted/20 flex items-center justify-center",
          className,
          onClick && "cursor-pointer"
        )}
        onClick={onClick}
      >
        <div className="text-center text-muted-foreground">
          <ImageOff className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">No Image</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn("relative w-full h-full", className)}
      onClick={onClick}
    >
      {/* Main image */}
      <img
        src={currentImage.url}
        alt={alt || artwork.title}
        className={cn(
          "w-full h-full object-cover transition-all duration-500",
          finalLoaded ? 'opacity-100 blur-0' : 'opacity-80',
          !thumbnailLoaded && 'opacity-0',
          onClick && "cursor-pointer"
        )}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading={priority ? "eager" : "lazy"}
        width={currentImage.width}
        height={currentImage.height}
      />
      
      {/* Loading overlay */}
      {(loading || !thumbnailLoaded) && (
        <div className="absolute inset-0 bg-muted/20 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      
      {/* Quality indicator (development only) */}
      {process.env.NODE_ENV === 'development' && currentImage && (
        <div className="absolute top-1 left-1 px-1 py-0.5 bg-black/60 text-white text-xs rounded">
          {currentImage.tier}-{currentImage.source}
          {!finalLoaded && currentImage.tier === 'thumbnail' && '→' + finalTier}
        </div>
      )}
      
      {/* Upgrade indicator */}
      {thumbnailLoaded && !finalLoaded && finalTier !== 'thumbnail' && (
        <div className="absolute bottom-1 right-1 px-2 py-1 bg-primary/80 text-primary-foreground text-xs rounded">
          Upgrading...
        </div>
      )}
    </div>
  );
}