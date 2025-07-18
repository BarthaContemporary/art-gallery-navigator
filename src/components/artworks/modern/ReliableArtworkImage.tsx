/**
 * Phase 1 & 2: Reliable Artwork Image Component
 * 
 * Simple, fast component that doesn't get stuck in loops.
 * Uses direct storage URLs first, avoiding complex Cloudinary resolution.
 * Implements proper error boundaries and loading states.
 */

import React, { useState, useEffect } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { Artwork } from "@/hooks/use-artworks";
import { ImageUrlResolver, ImageTier, ResolvedImageUrl } from "@/services/image-url-resolver";
import { cn } from "@/lib/utils";

interface ReliableArtworkImageProps {
  artwork: Artwork;
  tier?: ImageTier;
  className?: string;
  alt?: string;
  priority?: boolean;
  onClick?: () => void;
  preferCloudinary?: boolean;
}

export function ReliableArtworkImage({
  artwork,
  tier = 'medium',
  className,
  alt,
  priority = false,
  onClick,
  preferCloudinary = false
}: ReliableArtworkImageProps) {
  const [resolvedImage, setResolvedImage] = useState<ResolvedImageUrl | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const resolveImage = async () => {
      try {
        setIsLoading(true);
        setHasError(false);
        
        const resolved = await ImageUrlResolver.resolveImageUrl(
          artwork,
          tier,
          preferCloudinary
        );
        
        if (isMounted) {
          setResolvedImage(resolved);
          
          // If it's a placeholder, no need to load
          if (resolved.source === 'placeholder') {
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error('Failed to resolve image URL:', error);
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
  }, [artwork.id, tier, preferCloudinary]);

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  // Show placeholder if no resolved image or error
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
      
      {/* Source indicator (only in development) */}
      {process.env.NODE_ENV === 'development' && resolvedImage && (
        <div className="absolute top-1 left-1 px-1 py-0.5 bg-black/60 text-white text-xs rounded">
          {resolvedImage.source}
        </div>
      )}
    </div>
  );
}