
import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ImageOff, Loader2 } from "lucide-react";
import { CloudinaryImageService } from "@/services/cloudinary-image-service";
import type { LocalImageRecord } from "@/services/local-image-service";

interface OptimizedCarouselImageProps {
  imageRecord: LocalImageRecord;
  title: string;
  priority?: boolean;
  isVisible?: boolean;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}

interface ImageState {
  thumbnail: string | null;
  medium: string | null;
  full: string | null;
  currentTier: 'thumbnail' | 'medium' | 'full';
  loaded: Set<string>;
  loading: boolean;
  error: boolean;
}

export function OptimizedCarouselImage({
  imageRecord,
  title,
  priority = false,
  isVisible = true,
  className,
  onLoad,
  onError
}: OptimizedCarouselImageProps) {
  const [imageState, setImageState] = useState<ImageState>({
    thumbnail: null,
    medium: null,
    full: null,
    currentTier: 'thumbnail',
    loaded: new Set(),
    loading: true,
    error: false
  });

  const mountedRef = useRef(true);
  const loadingTimeoutRef = useRef<NodeJS.Timeout>();

  // Get URLs for different tiers
  const getImageUrls = useCallback(() => {
    const thumbnail = CloudinaryImageService.getBestImageUrl(imageRecord, 'thumbnail');
    const medium = CloudinaryImageService.getBestImageUrl(imageRecord, 'medium');
    const full = CloudinaryImageService.getBestImageUrl(imageRecord, 'full');
    
    return { thumbnail, medium, full };
  }, [imageRecord]);

  // Preload image with caching
  const preloadImage = useCallback(async (url: string, tier: string): Promise<boolean> => {
    if (!url || url === '/placeholder.svg') return false;
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (mountedRef.current) {
          setImageState(prev => ({
            ...prev,
            loaded: new Set(prev.loaded).add(tier)
          }));
        }
        resolve(true);
      };
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }, []);

  // Progressive loading strategy
  const loadImages = useCallback(async () => {
    if (!mountedRef.current) return;

    const urls = getImageUrls();
    
    setImageState({
      thumbnail: urls.thumbnail,
      medium: urls.medium,
      full: urls.full,
      currentTier: 'thumbnail',
      loaded: new Set(),
      loading: true,
      error: false
    });

    try {
      // Start with timeout for slow loading
      loadingTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setImageState(prev => ({ ...prev, loading: false, error: true }));
          onError?.();
        }
      }, priority ? 3000 : 5000);

      // Load thumbnail first (fastest)
      if (urls.thumbnail !== '/placeholder.svg') {
        const thumbnailLoaded = await preloadImage(urls.thumbnail, 'thumbnail');
        if (thumbnailLoaded && mountedRef.current) {
          setImageState(prev => ({ ...prev, loading: false }));
          onLoad?.();
          
          // Clear timeout since we have something to show
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
          }

          // Load medium quality in background (for priority images or when visible)
          if ((priority || isVisible) && urls.medium !== '/placeholder.svg') {
            setTimeout(async () => {
              const mediumLoaded = await preloadImage(urls.medium, 'medium');
              if (mediumLoaded && mountedRef.current) {
                setImageState(prev => ({ ...prev, currentTier: 'medium' }));
                
                // Load full quality for priority images only
                if (priority && urls.full !== '/placeholder.svg') {
                  setTimeout(async () => {
                    const fullLoaded = await preloadImage(urls.full, 'full');
                    if (fullLoaded && mountedRef.current) {
                      setImageState(prev => ({ ...prev, currentTier: 'full' }));
                    }
                  }, 100);
                }
              }
            }, 50);
          }
        }
      }

      // If no thumbnail, try medium directly
      if (urls.thumbnail === '/placeholder.svg' && urls.medium !== '/placeholder.svg') {
        const mediumLoaded = await preloadImage(urls.medium, 'medium');
        if (mediumLoaded && mountedRef.current) {
          setImageState(prev => ({ 
            ...prev, 
            currentTier: 'medium',
            loading: false 
          }));
          onLoad?.();
        }
      }

      // If nothing works, show error
      if (urls.thumbnail === '/placeholder.svg' && urls.medium === '/placeholder.svg' && urls.full === '/placeholder.svg') {
        if (mountedRef.current) {
          setImageState(prev => ({ ...prev, loading: false, error: true }));
          onError?.();
        }
      }

    } catch (error) {
      console.error('Failed to load carousel image:', error);
      if (mountedRef.current) {
        setImageState(prev => ({ ...prev, loading: false, error: true }));
        onError?.();
      }
    }
  }, [getImageUrls, preloadImage, priority, isVisible, onLoad, onError]);

  // Load images when component mounts or imageRecord changes
  useEffect(() => {
    loadImages();
    
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [loadImages]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Upgrade to higher quality when visible and not loading
  useEffect(() => {
    if (!isVisible || imageState.loading || !mountedRef.current) return;
    
    // Upgrade to medium if we only have thumbnail
    if (imageState.currentTier === 'thumbnail' && 
        imageState.loaded.has('thumbnail') && 
        !imageState.loaded.has('medium') && 
        imageState.medium !== '/placeholder.svg') {
      
      setTimeout(() => {
        preloadImage(imageState.medium!, 'medium').then(loaded => {
          if (loaded && mountedRef.current) {
            setImageState(prev => ({ ...prev, currentTier: 'medium' }));
          }
        });
      }, 200);
    }

    // Upgrade to full if we have medium and this is priority
    if (priority && 
        imageState.currentTier === 'medium' && 
        imageState.loaded.has('medium') && 
        !imageState.loaded.has('full') && 
        imageState.full !== '/placeholder.svg') {
      
      setTimeout(() => {
        preloadImage(imageState.full!, 'full').then(loaded => {
          if (loaded && mountedRef.current) {
            setImageState(prev => ({ ...prev, currentTier: 'full' }));
          }
        });
      }, 500);
    }
  }, [isVisible, imageState, priority, preloadImage]);

  // Get current image URL
  const currentImageUrl = (() => {
    const { currentTier, loaded } = imageState;
    
    if (loaded.has('full') && imageState.full) return imageState.full;
    if (loaded.has('medium') && imageState.medium) return imageState.medium;
    if (loaded.has('thumbnail') && imageState.thumbnail) return imageState.thumbnail;
    
    // Fallback to best available URL even if not loaded yet
    if (imageState.full !== '/placeholder.svg') return imageState.full;
    if (imageState.medium !== '/placeholder.svg') return imageState.medium;
    if (imageState.thumbnail !== '/placeholder.svg') return imageState.thumbnail;
    
    return '/placeholder.svg';
  })();

  // Show error state
  if (imageState.error || currentImageUrl === '/placeholder.svg') {
    return (
      <div className={cn(
        "w-full h-full bg-muted/10 flex items-center justify-center",
        className
      )}>
        <div className="text-center text-muted-foreground">
          <ImageOff className="w-12 h-12 mx-auto mb-2 opacity-60" />
          <p className="text-sm">Image unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative w-full h-full", className)}>
      <img
        src={currentImageUrl}
        alt={title}
        className={cn(
          "w-full h-full object-contain transition-opacity duration-300",
          imageState.loading ? "opacity-0" : "opacity-100"
        )}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
      />
      
      {/* Loading overlay */}
      {imageState.loading && (
        <div className="absolute inset-0 bg-muted/20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}
      
      {/* Quality indicator for development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
          {imageState.currentTier}
          {imageState.loaded.size > 1 && ` (${imageState.loaded.size} loaded)`}
        </div>
      )}
    </div>
  );
}
