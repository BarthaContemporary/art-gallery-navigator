/**
 * Clean Artwork Image Component
 * Reliable image display with loading states
 */

import React, { useState, useEffect } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { ArtworkImageService } from "@/services/artwork-image-service";
import type { Artwork, ImageTier, ResolvedImage } from "@/types/artwork";
import { cn } from "@/lib/utils";

interface ArtworkImageProps {
  artwork: Artwork;
  tier?: ImageTier;
  className?: string;
  alt?: string;
  priority?: boolean;
  onClick?: () => void;
}

export function ArtworkImage({
  artwork,
  tier = 'medium',
  className,
  alt,
  priority = false,
  onClick
}: ArtworkImageProps) {
  const [resolvedImage, setResolvedImage] = useState<ResolvedImage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const resolveImage = async () => {
      try {
        setIsLoading(true);
        setHasError(false);
        
        const resolved = await ArtworkImageService.resolveImage(artwork, tier);
        
        if (isMounted) {
          setResolvedImage(resolved);
          
          // If it's a placeholder, no need to wait for load
          if (resolved.source === 'placeholder') {
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error('Failed to resolve image:', error);
        if (isMounted) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    };

    resolveImage();

    return () => {
      isMounted = false;
    };
  }, [artwork.id, tier]);

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
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
      
      {/* Development info */}
      {process.env.NODE_ENV === 'development' && resolvedImage && (
        <div className="absolute top-1 left-1 px-1 py-0.5 bg-black/60 text-white text-xs rounded">
          {resolvedImage.source}-{tier}
        </div>
      )}
    </div>
  );
}