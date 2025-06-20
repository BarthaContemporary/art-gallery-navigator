
import React, { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Loader2, ImageOff, AlertCircle } from "lucide-react";
import { logger } from "@/lib/logger";
import { LocalImageService, type LocalImageRecord, type ImageSize } from "@/services/local-image-service";

interface LocalArtworkImageProps {
  imageRecord?: LocalImageRecord;
  title: string;
  onClick?: () => void;
  className?: string;
  size?: ImageSize;
  showProcessingStatus?: boolean;
}

export function LocalArtworkImage({
  imageRecord,
  title,
  onClick,
  className = "",
  size = 'medium',
  showProcessingStatus = false
}: LocalArtworkImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('/placeholder.svg');

  // Get image URL when component mounts or imageRecord changes
  useEffect(() => {
    if (!imageRecord) {
      setImageUrl('/placeholder.svg');
      setIsLoading(false);
      setHasError(true);
      return;
    }

    const url = LocalImageService.getBestImageUrl(imageRecord, size);
    setImageUrl(url);
    
    if (url === '/placeholder.svg') {
      setHasError(true);
      setIsLoading(false);
    } else {
      setHasError(false);
      setIsLoading(true);
    }
  }, [imageRecord, size]);

  const handleImageLoad = useCallback(() => {
    logger.log(`[LocalArtworkImage] Image loaded successfully: ${title}`);
    setIsLoading(false);
    setHasError(false);
  }, [title]);

  const handleImageError = useCallback(() => {
    logger.error(`[LocalArtworkImage] Image load error: ${title} - ${imageUrl}`);
    setHasError(true);
    setIsLoading(false);
    
    // If this wasn't already the placeholder, fall back to it
    if (imageUrl !== '/placeholder.svg') {
      setImageUrl('/placeholder.svg');
    }
  }, [title, imageUrl]);

  // Show processing status if image is still being processed
  const isProcessing = imageRecord?.processing_status === 'processing' || 
                     imageRecord?.processing_status === 'pending';
  const hasFailed = imageRecord?.processing_status === 'failed';

  // Error state
  if (hasError && imageUrl === '/placeholder.svg') {
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
          {hasFailed && showProcessingStatus && (
            <p className="text-xs text-red-500 mt-1">Processing Failed</p>
          )}
        </div>
      </div>
    );
  }

  // Use object-cover for thumbnail size (artwork cards) and object-contain for larger sizes
  const objectFit = size === 'thumbnail' ? 'object-cover' : 'object-contain';

  return (
    <div 
      className={cn(
        "relative w-full h-full bg-muted/10 overflow-hidden flex items-center justify-center",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <img
        src={imageUrl}
        alt={title}
        className={cn(
          `w-full h-full ${objectFit} transition-opacity duration-300`,
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

      {/* Processing Status Overlay */}
      {showProcessingStatus && isProcessing && (
        <div className="absolute top-2 left-2 bg-blue-500/90 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Processing
        </div>
      )}

      {/* Failed Processing Overlay */}
      {showProcessingStatus && hasFailed && (
        <div className="absolute top-2 left-2 bg-red-500/90 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Failed
        </div>
      )}
    </div>
  );
}
