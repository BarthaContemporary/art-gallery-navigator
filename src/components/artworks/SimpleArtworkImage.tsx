import React, { useState } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { ImageOff } from "lucide-react";

interface SimpleArtworkImageProps {
  artwork: Artwork;
}

export function SimpleArtworkImage({ artwork }: SimpleArtworkImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Get the best available image URL
  const getImageUrl = () => {
    // Try to get the primary image or first image
    const primaryImage = artwork.artwork_images?.find(img => img.is_primary) || 
                         artwork.artwork_images?.[0];
    
    if (primaryImage) {
      // Priority: thumbnail -> medium -> original
      if (primaryImage.thumbnail_url && !primaryImage.thumbnail_url.includes('processing')) {
        return primaryImage.thumbnail_url;
      }
      if (primaryImage.medium_url && !primaryImage.medium_url.includes('processing')) {
        return primaryImage.medium_url;
      }
      if (primaryImage.image_url && !primaryImage.image_url.includes('processing')) {
        return primaryImage.image_url;
      }
    }
    
    // Fallback to artwork's main image_url
    if (artwork.image_url && !artwork.image_url.includes('processing')) {
      return artwork.image_url;
    }
    
    return null;
  };

  const imageUrl = getImageUrl();

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (!imageUrl || hasError) {
    return (
      <div className="w-full h-full bg-muted/20 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <ImageOff className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">No Image</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <img
        src={imageUrl}
        alt={artwork.title}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
      />
      
      {isLoading && (
        <div className="absolute inset-0 bg-muted/20 animate-pulse" />
      )}
    </div>
  );
}