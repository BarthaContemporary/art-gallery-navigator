/**
 * Phase 4: Smart Artwork Image with Performance Optimizations
 * 
 * Combines health monitoring, progressive loading, and intelligent caching
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ImageOff, Loader2, Wifi, WifiOff } from "lucide-react";
import { Artwork } from "@/hooks/use-artworks";
import { EnhancedCloudinaryResolver } from "@/services/cloudinary/enhanced-url-resolver";
import { ImageTier } from "@/services/cloudinary/types";
import { useCloudinaryHealth } from "@/hooks/use-cloudinary-health";
import { cn } from "@/lib/utils";

interface SmartArtworkImageProps {
  artwork: Artwork;
  finalTier?: ImageTier;
  className?: string;
  alt?: string;
  priority?: boolean;
  onClick?: () => void;
  onLoad?: () => void;
  onError?: (error: string) => void;
  preloadNext?: Artwork[];
  showHealthIndicator?: boolean;
}

interface ImageState {
  url: string;
  source: string;
  tier: ImageTier;
  confidence: number;
  loaded: boolean;
  loading: boolean;
  error: boolean;
}

export function SmartArtworkImage({
  artwork,
  finalTier = 'medium',
  className,
  alt,
  priority = false,
  onClick,
  onLoad,
  onError,
  preloadNext = [],
  showHealthIndicator = false
}: SmartArtworkImageProps) {
  const { health, shouldUseCloudinary } = useCloudinaryHealth();
  const [thumbnailState, setThumbnailState] = useState<ImageState | null>(null);
  const [finalState, setFinalState] = useState<ImageState | null>(null);
  const [currentStage, setCurrentStage] = useState<'loading' | 'thumbnail' | 'final' | 'error'>('loading');
  const mountedRef = useRef(true);
  const preloadCacheRef = useRef(new Set<string>());

  // Memoize the loading strategy based on health status
  const loadingStrategy = useMemo(() => ({
    preferCloudinary: shouldUseCloudinary && health.isHealthy,
    enableProgressive: !priority, // Skip progressive for priority images
    maxRetries: shouldUseCloudinary ? 2 : 1,
    timeout: health.isHealthy ? 5000 : 3000
  }), [shouldUseCloudinary, health.isHealthy, priority]);

  // Smart loading effect with health-aware strategy
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const loadSmartProgressive = async () => {
      try {
        setCurrentStage('loading');

        // Stage 1: Load thumbnail immediately
        const thumbnailResult = await EnhancedCloudinaryResolver.resolveImageUrl(
          artwork,
          'thumbnail',
          loadingStrategy.preferCloudinary
        );

        if (cancelled || !mountedRef.current) return;

        if (thumbnailResult.confidence > 0) {
          setThumbnailState({
            url: thumbnailResult.url,
            source: thumbnailResult.source,
            tier: thumbnailResult.tier,
            confidence: thumbnailResult.confidence,
            loaded: false,
            loading: true,
            error: false
          });
          setCurrentStage('thumbnail');
        }

        // Stage 2: Load final quality if needed
        if (finalTier !== 'thumbnail' && loadingStrategy.enableProgressive) {
          const finalResult = await EnhancedCloudinaryResolver.resolveImageUrl(
            artwork,
            finalTier,
            loadingStrategy.preferCloudinary
          );

          if (cancelled || !mountedRef.current) return;

          if (finalResult.confidence > 0) {
            // Preload the final image before switching
            try {
              await EnhancedCloudinaryResolver.preloadImage(finalResult.url);
              
              if (cancelled || !mountedRef.current) return;
              
              setFinalState({
                url: finalResult.url,
                source: finalResult.source,
                tier: finalResult.tier,
                confidence: finalResult.confidence,
                loaded: true,
                loading: false,
                error: false
              });
              setCurrentStage('final');
            } catch (preloadError) {
              console.debug('Preload failed, using thumbnail:', preloadError);
            }
          }
        } else if (finalTier === 'thumbnail') {
          setCurrentStage('final');
        }

        // Stage 3: Intelligent preloading of next images
        if (preloadNext.length > 0 && !cancelled && mountedRef.current) {
          preloadNextImages(preloadNext.slice(0, 2)); // Limit to 2 for performance
        }

      } catch (error) {
        console.error('Smart progressive loading failed:', error);
        if (!cancelled && mountedRef.current) {
          setCurrentStage('error');
          onError?.(error instanceof Error ? error.message : 'Failed to load image');
        }
      }
    };

    loadSmartProgressive();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [artwork.id, finalTier, loadingStrategy, preloadNext]);

  // Intelligent preloading based on viewport and connection
  const preloadNextImages = useCallback(async (nextArtworks: Artwork[]) => {
    // Check if we should preload (avoid on slow connections)
    const connection = (navigator as any).connection;
    if (connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g')) {
      return;
    }

    for (const nextArtwork of nextArtworks) {
      const cacheKey = `${nextArtwork.id}-thumbnail`;
      
      if (preloadCacheRef.current.has(cacheKey)) continue;
      preloadCacheRef.current.add(cacheKey);

      try {
        const nextResult = await EnhancedCloudinaryResolver.resolveImageUrl(
          nextArtwork,
          'thumbnail',
          loadingStrategy.preferCloudinary
        );
        
        if (nextResult.confidence > 0.5) {
          EnhancedCloudinaryResolver.preloadImage(nextResult.url);
        }
      } catch (error) {
        console.debug('Preload failed for next image:', error);
      }
    }
  }, [loadingStrategy.preferCloudinary]);

  // Handle image load events
  const handleThumbnailLoad = useCallback(() => {
    if (!mountedRef.current) return;
    
    setThumbnailState(prev => prev ? { ...prev, loaded: true, loading: false } : null);
    
    if (currentStage === 'thumbnail' && finalTier === 'thumbnail') {
      onLoad?.();
    }
  }, [currentStage, finalTier, onLoad]);

  const handleFinalLoad = useCallback(() => {
    if (!mountedRef.current) return;
    
    setFinalState(prev => prev ? { ...prev, loaded: true, loading: false } : null);
    onLoad?.();
  }, [onLoad]);

  const handleImageError = useCallback(() => {
    if (!mountedRef.current) return;
    
    setCurrentStage('error');
    onError?.('Image failed to load');
  }, [onError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Determine which image to show
  const displayImage = finalState?.loaded ? finalState : thumbnailState;
  const isLoading = currentStage === 'loading' || (displayImage?.loading && !displayImage?.loaded);
  const hasError = currentStage === 'error' || !displayImage || displayImage.url === '/placeholder.svg';

  // Render error state
  if (hasError) {
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
          {showHealthIndicator && (
            <div className="mt-1 text-xs opacity-60">
              {shouldUseCloudinary ? 'CDN Available' : 'CDN Unavailable'}
            </div>
          )}
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
        src={displayImage.url}
        alt={alt || artwork.title}
        className={cn(
          "w-full h-full object-cover transition-all duration-500",
          finalState?.loaded ? 'opacity-100 blur-0' : 'opacity-90',
          !displayImage.loaded && 'opacity-0',
          onClick && "cursor-pointer"
        )}
        onLoad={finalState?.loaded ? handleFinalLoad : handleThumbnailLoad}
        onError={handleImageError}
        loading={priority ? "eager" : "lazy"}
      />
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-muted/20 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      
      {/* Health indicator */}
      {showHealthIndicator && (
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {shouldUseCloudinary ? (
            <Wifi className="h-3 w-3 text-green-500" />
          ) : (
            <WifiOff className="h-3 w-3 text-amber-500" />
          )}
        </div>
      )}
      
      {/* Quality/Performance indicator (development only) */}
      {process.env.NODE_ENV === 'development' && displayImage && (
        <div className="absolute top-1 left-1 px-1 py-0.5 bg-black/60 text-white text-xs rounded">
          {displayImage.tier}-{displayImage.source}
          <div className="text-xs opacity-80">
            {Math.round(displayImage.confidence * 100)}% confidence
          </div>
          {!finalState?.loaded && finalTier !== 'thumbnail' && (
            <div className="text-green-400">→{finalTier}</div>
          )}
        </div>
      )}
      
      {/* Upgrade indicator */}
      {thumbnailState?.loaded && !finalState?.loaded && finalTier !== 'thumbnail' && (
        <div className="absolute bottom-1 right-1 px-2 py-1 bg-primary/80 text-primary-foreground text-xs rounded">
          Enhancing...
        </div>
      )}
    </div>
  );
}