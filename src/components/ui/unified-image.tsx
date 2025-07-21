
/**
 * Unified Image Component
 * Single component for all image display needs across the application
 */

import React, { useState, useEffect, useRef } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { UnifiedImageService, type ResolvedImageData } from "@/services/unified-image-service";
import type { Artwork } from "@/types/artwork";
import { cn } from "@/lib/utils";

interface UnifiedImageProps {
  artwork: Artwork;
  tier?: 'thumbnail' | 'medium' | 'large' | 'original';
  className?: string;
  alt?: string;
  priority?: boolean;
  onClick?: () => void;
  showErrorDetails?: boolean;
}

export function UnifiedImage({
  artwork,
  tier = 'medium',
  className,
  alt,
  priority = false,
  onClick,
  showErrorDetails = false
}: UnifiedImageProps) {
  const [resolvedImage, setResolvedImage] = useState<ResolvedImageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const resolveImage = async () => {
      try {
        setIsLoading(true);
        setHasError(false);
        
        const resolved = await UnifiedImageService.resolveImageUrl(artwork, tier);
        
        if (!isCancelled && mountedRef.current) {
          setResolvedImage(resolved);
          
          // If it's a placeholder, no need to wait for load
          if (resolved.source === 'placeholder') {
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error('Failed to resolve image for artwork:', artwork.id, error);
        if (!isCancelled && mountedRef.current) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    };

    resolveImage();

    return () => {
      isCancelled = true;
    };
  }, [artwork.id, tier]);

  const handleImageLoad = () => {
    if (mountedRef.current) {
      setIsLoading(false);
      setHasError(false);
    }
  };

  const handleImageError = () => {
    if (mountedRef.current) {
      setIsLoading(false);
      setHasError(true);
    }
  };

  // Show placeholder if no resolved image, error, or is placeholder
  if (!resolvedImage || hasError || resolvedImage.source === 'placeholder') {
    return (
      <div 
        className={cn(
          "w-full h-full bg-muted/20 flex items-center justify-center",
          className,
          onClick && "cursor-pointer"
        )}
        onClick={onClick}
      >
        <div className="text-center text-muted-foreground p-4">
          <ImageOff className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">No Image</p>
          {showErrorDetails && hasError && (
            <p className="text-xs mt-1 opacity-75">Failed to load</p>
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
      <img
        src={resolvedImage.url}
        alt={alt || artwork.title}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          isLoading ? 'opacity-0' : 'opacity-100',
          onClick && "cursor-pointer"
        )}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading={priority ? "eager" : "lazy"}
        width={resolvedImage.width}
        height={resolvedImage.height}
      />
      
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 bg-muted/20 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      
    </div>
  );
}
