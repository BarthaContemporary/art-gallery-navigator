
import React, { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Loader2, ImageOff, AlertCircle } from "lucide-react";
import { logger } from "@/lib/logger";
import { CloudinaryImageService } from "@/services/cloudinary-image-service";
import type { LocalImageRecord, ImageSize } from "@/services/local-image-service";

interface LocalArtworkImageProps {
  imageRecord?: LocalImageRecord;
  title: string;
  onClick?: () => void;
  className?: string;
  size?: ImageSize;
  showProcessingStatus?: boolean;
}

const SIZE_FALLBACK_HIERARCHY: ImageSize[] = ['original', 'large', 'medium', 'thumbnail'];

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
  const [currentFallbackIndex, setCurrentFallbackIndex] = useState(0);

  // Get fallback sizes starting from requested size
  const getFallbackSizes = useCallback((requestedSize: ImageSize): ImageSize[] => {
    const requestedIndex = SIZE_FALLBACK_HIERARCHY.indexOf(requestedSize);
    if (requestedIndex === -1) return SIZE_FALLBACK_HIERARCHY;
    
    // Start from requested size and include all larger sizes
    return SIZE_FALLBACK_HIERARCHY.slice(requestedIndex);
  }, []);

  // Get image URL when component mounts or imageRecord changes
  useEffect(() => {
    if (!imageRecord) {
      logger.warn(`[LocalArtworkImage] No image record for: ${title}`);
      setImageUrl('/placeholder.svg');
      setIsLoading(false);
      setHasError(true);
      return;
    }

    // Reset fallback state
    setCurrentFallbackIndex(0);
    setHasError(false);

    // Map ImageSize to CloudinaryImageService tier
    const tierMap: Record<ImageSize, 'thumbnail' | 'medium' | 'full'> = {
      thumbnail: 'thumbnail',
      medium: 'medium',
      large: 'full',
      original: 'full'
    };

    const tier = tierMap[size];
    logger.log(`[LocalArtworkImage] Resolving image URL for: ${title}`, {
      imageRecordId: imageRecord.id,
      tier,
      processingStatus: imageRecord.processing_status,
      isLegacy: imageRecord.id?.startsWith('legacy-')
    });

    const url = CloudinaryImageService.getBestImageUrl(imageRecord, tier);
    setImageUrl(url);
    
    if (url === '/placeholder.svg') {
      logger.warn(`[LocalArtworkImage] No valid URL found for: ${title}`);
      setHasError(true);
      setIsLoading(false);
    } else {
      logger.log(`[LocalArtworkImage] Using URL for ${title}: ${url}`);
      setIsLoading(true);
    }
  }, [imageRecord, size, title]);

  const tryNextFallback = useCallback(() => {
    if (!imageRecord) return false;

    const fallbackSizes = getFallbackSizes(size);
    const nextIndex = currentFallbackIndex + 1;

    if (nextIndex >= fallbackSizes.length) {
      // No more fallbacks available
      return false;
    }

    const nextSize = fallbackSizes[nextIndex];
    const tierMap: Record<ImageSize, 'thumbnail' | 'medium' | 'full'> = {
      thumbnail: 'thumbnail',
      medium: 'medium',
      large: 'full',
      original: 'full'
    };

    const nextTier = tierMap[nextSize];
    const fallbackUrl = CloudinaryImageService.getBestImageUrl(imageRecord, nextTier);

    if (fallbackUrl !== '/placeholder.svg' && fallbackUrl !== imageUrl) {
      logger.log(`[LocalArtworkImage] Trying fallback ${nextSize} for ${title}: ${fallbackUrl}`);
      setImageUrl(fallbackUrl);
      setCurrentFallbackIndex(nextIndex);
      setIsLoading(true);
      return true;
    }

    // Try next fallback if this one is also invalid
    setCurrentFallbackIndex(nextIndex);
    return tryNextFallback();
  }, [imageRecord, size, title, currentFallbackIndex, imageUrl, getFallbackSizes]);

  const handleImageLoad = useCallback(() => {
    logger.log(`[LocalArtworkImage] Image loaded successfully: ${title} - ${imageUrl}`);
    setIsLoading(false);
    setHasError(false);
  }, [title, imageUrl]);

  const handleImageError = useCallback(() => {
    logger.error(`[LocalArtworkImage] Image load error: ${title} - ${imageUrl}`);
    
    // Try next fallback size
    if (tryNextFallback()) {
      logger.log(`[LocalArtworkImage] Attempting fallback for ${title}`);
      return;
    }
    
    // No more fallbacks, try original storage path if available
    if (imageRecord?.original_storage_path && imageUrl !== '/placeholder.svg') {
      const fallbackUrl = CloudinaryImageService.getSupabaseStorageUrl(
        imageRecord.original_storage_path,
        'artwork-images-original'
      );
      
      if (fallbackUrl !== imageUrl && fallbackUrl !== '/placeholder.svg') {
        logger.log(`[LocalArtworkImage] Trying original storage fallback for ${title}: ${fallbackUrl}`);
        setImageUrl(fallbackUrl);
        setIsLoading(true);
        return;
      }
    }
    
    // Final fallback to placeholder
    logger.warn(`[LocalArtworkImage] All fallbacks exhausted for ${title}, using placeholder`);
    setHasError(true);
    setIsLoading(false);
    setImageUrl('/placeholder.svg');
  }, [title, imageUrl, imageRecord, tryNextFallback]);

  // Show processing status if image is still being processed
  const isProcessing = imageRecord?.processing_status === 'processing' || 
                     imageRecord?.processing_status === 'pending';
  const hasFailed = imageRecord?.processing_status === 'failed';
  const isLegacyImage = imageRecord?.id?.startsWith('legacy-');

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
          {isProcessing && showProcessingStatus && (
            <p className="text-xs text-blue-500 mt-1">Processing...</p>
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
      {showProcessingStatus && isProcessing && !isLegacyImage && (
        <div className="absolute top-2 left-2 bg-blue-500/90 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Processing
        </div>
      )}

      {/* Failed Processing Overlay */}
      {showProcessingStatus && hasFailed && !isLegacyImage && (
        <div className="absolute top-2 left-2 bg-red-500/90 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Failed
        </div>
      )}
    </div>
  );
}
