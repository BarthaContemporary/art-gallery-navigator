
import React, { useState, useEffect, useCallback } from "react";
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
  const [state, setState] = useState<{
    isLoading: boolean;
    hasError: boolean;
    currentUrl: string | null;
  }>({
    isLoading: true,
    hasError: false,
    currentUrl: null
  });

  // Initialize image URL and handle processing
  useEffect(() => {
    if (!imageRecord) {
      setState({
        isLoading: false,
        hasError: true,
        currentUrl: null
      });
      return;
    }

    const status = CloudinaryImageService.analyzeProcessingStatus(imageRecord);
    const bestUrl = CloudinaryImageService.getBestAvailableUrl(imageRecord, tier);
    
    logger.log(`[${title}] Image status:`, {
      isProcessed: status.isProcessed,
      needsProcessing: status.needsProcessing,
      bestUrl
    });

    setState({
      isLoading: true,
      hasError: false,
      currentUrl: bestUrl
    });

    // Trigger background processing if needed
    if (status.needsProcessing && !status.processingInProgress) {
      CloudinaryImageService.triggerProcessing(imageRecord);
    }
  }, [imageRecord, tier, title]);

  const handleImageLoad = useCallback(() => {
    logger.log(`[${title}] ✅ Image loaded successfully: ${state.currentUrl}`);
    setState(prev => ({
      ...prev,
      isLoading: false,
      hasError: false
    }));
    onLoadingComplete?.();
  }, [title, state.currentUrl, onLoadingComplete]);

  const handleImageError = useCallback(() => {
    logger.error(`[${title}] ❌ Image failed to load: ${state.currentUrl}`);
    
    // For Cloudinary errors, fall back to original URL
    if (imageRecord?.image_url && state.currentUrl !== imageRecord.image_url) {
      logger.log(`[${title}] 🔄 Trying original URL: ${imageRecord.image_url}`);
      setState(prev => ({
        ...prev,
        currentUrl: imageRecord.image_url,
        isLoading: true
      }));
    } else {
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true
      }));
      onLoadingComplete?.();
    }
  }, [title, state.currentUrl, imageRecord, onLoadingComplete]);

  const handleLoadStart = useCallback(() => {
    logger.log(`[${title}] 🔄 Loading started: ${state.currentUrl}`);
    onLoadingStart?.();
  }, [title, state.currentUrl, onLoadingStart]);

  // Error state
  if (!state.currentUrl || (state.hasError && !state.isLoading)) {
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
        src={state.currentUrl}
        alt={title}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          state.isLoading ? "opacity-0" : "opacity-100"
        )}
        onLoadStart={handleLoadStart}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
        decoding="async"
      />
      
      {/* Loading State */}
      {state.isLoading && (
        <div className="absolute inset-0 bg-muted/20 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
        </div>
      )}
    </div>
  );
}
