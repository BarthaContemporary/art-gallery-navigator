import React, { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";
import type { ImageRecord } from "@/utils/image-url-resolver";

interface ArtworkImageRendererProps {
  imageRecord?: ImageRecord;
  title: string;
  onClick?: () => void;
  className?: string;
  tier?: 'thumbnail' | 'medium' | 'full';
  priority?: boolean; // For above-the-fold images
}

export function ArtworkImageRenderer({
  imageRecord,
  title,
  onClick,
  className,
  tier = 'thumbnail',
  priority = false
}: ArtworkImageRendererProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fast URL selection - prioritize processed URLs, filter out "processing" URLs
  const imageUrl = useMemo(() => {
    if (!imageRecord) return '/placeholder.svg';

    const isValidUrl = (url: string | null | undefined): boolean => {
      return url && url !== '/placeholder.svg' && !url.includes('processing') && !url.includes('undefined');
    };

    // Priority order based on tier
    switch (tier) {
      case 'thumbnail':
        if (isValidUrl(imageRecord.thumbnail_url)) return imageRecord.thumbnail_url!;
        if (isValidUrl(imageRecord.medium_url)) return imageRecord.medium_url!;
        if (isValidUrl(imageRecord.image_url)) return imageRecord.image_url;
        break;
      
      case 'medium':
        if (isValidUrl(imageRecord.medium_url)) return imageRecord.medium_url!;
        if (isValidUrl(imageRecord.image_url)) return imageRecord.image_url;
        if (isValidUrl(imageRecord.thumbnail_url)) return imageRecord.thumbnail_url!;
        break;
      
      case 'full':
        if (isValidUrl(imageRecord.image_url)) return imageRecord.image_url;
        if (isValidUrl(imageRecord.medium_url)) return imageRecord.medium_url!;
        if (isValidUrl(imageRecord.thumbnail_url)) return imageRecord.thumbnail_url!;
        break;
    }

    return '/placeholder.svg';
  }, [imageRecord, tier]);

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  // Show placeholder for invalid URLs or errors
  if (imageUrl === '/placeholder.svg' || hasError) {
    return (
      <div 
        className={cn(
          "relative w-full h-full bg-muted/5 overflow-hidden flex items-center justify-center",
          onClick && "cursor-pointer hover:bg-muted/10 transition-colors",
          className
        )}
        onClick={onClick}
      >
        <div className="text-center text-muted-foreground/60">
          <ImageOff className="w-6 h-6 mx-auto mb-1" />
          <p className="text-xs">No Image</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "relative w-full h-full bg-muted/5 overflow-hidden",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <img
        src={imageUrl}
        alt={title}
        className={cn(
          "w-full h-full object-contain transition-all duration-300",
          isLoading ? "opacity-0 scale-110" : "opacity-100 scale-100",
          onClick && "hover:scale-105"
        )}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        style={{
          contentVisibility: "auto",
          containIntrinsicSize: "300px 200px"
        }}
      />
      
      {/* Simple loading state */}
      {isLoading && (
        <div className="absolute inset-0 bg-muted/5 animate-pulse" />
      )}
    </div>
  );
}