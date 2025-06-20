
import React, { useState, useCallback } from "react";
import type { ArtworkImage } from "@/hooks/use-artworks";
import { cn } from "@/lib/utils";
import { Loader2, ImageOff } from "lucide-react";
import { CloudinaryImageService } from "@/services/cloudinary-image-service";
import { logger } from "@/lib/logger";

interface CloudinaryArtworkImageProps {
  imageRecord?: ArtworkImage;
  title: string;
  onClick?: () => void;
  className?: string;
  tier?: 'thumbnail' | 'medium' | 'full';
  onLoadingStart?: () => void;
  onLoadingComplete?: () => void;
}

export function CloudinaryArtworkImage({
  imageRecord,
  title,
  onClick,
  className = "",
  tier = 'medium',
  onLoadingStart,
  onLoadingComplete
}: CloudinaryArtworkImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Get the best available URL
  const imageUrl = CloudinaryImageService.getBestAvailableUrl(imageRecord, tier);

  const handleImageLoad = useCallback(() => {
    logger.log(`[${title}] Image loaded successfully: ${imageUrl}`);
    setIsLoading(false);
    setHasError(false);
    onLoadingComplete?.();
  }, [title, imageUrl, onLoadingComplete]);

  const handleImageError = useCallback(() => {
    logger.error(`[${title}] Image failed to load: ${imageUrl}`);
    setIsLoading(false);
    setHasError(true);
    onLoadingComplete?.();
  }, [title, imageUrl, onLoadingComplete]);

  const handleLoadStart = useCallback(() => {
    logger.log(`[${title}] Loading started: ${imageUrl}`);
    setIsLoading(true);
    setHasError(false);
    onLoadingStart?.();
  }, [title, imageUrl, onLoadingStart]);

  // Trigger background processing if needed
  React.useEffect(() => {
    if (imageRecord && CloudinaryImageService.analyzeProcessingStatus(imageRecord).needsProcessing) {
      CloudinaryImageService.triggerProcessing(imageRecord);
    }
  }, [imageRecord]);

  // Error state
  if (hasError || !imageUrl || imageUrl === '/placeholder.svg') {
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
        src={imageUrl}
        alt={title}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100"
        )}
        onLoadStart={handleLoadStart}
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
