
import React from "react";
import { CloudinaryImageService } from "@/services/cloudinary-image-service";
import { SimpleArtworkImage } from "./SimpleArtworkImage";
import type { ImageRecord } from "@/utils/image-url-resolver";

interface OptimizedArtworkImageProps {
  imageRecord?: ImageRecord;
  title: string;
  onClick?: () => void;
  className?: string;
  tier?: 'thumbnail' | 'medium' | 'full';
  onLoadingStart?: () => void;
  onLoadingComplete?: () => void;
}

export function OptimizedArtworkImage({
  imageRecord,
  title,
  onClick,
  className,
  tier = 'medium'
}: OptimizedArtworkImageProps) {
  // If we have a Cloudinary-compatible image record, use CloudinaryImageService
  if (imageRecord && (imageRecord.thumbnail_url || imageRecord.medium_url || imageRecord.processed)) {
    const optimizedUrl = CloudinaryImageService.getBestImageUrl(imageRecord, tier);
    
    // Create a modified image record with the optimized URL
    const optimizedImageRecord: ImageRecord = {
      ...imageRecord,
      image_url: optimizedUrl
    };

    return (
      <SimpleArtworkImage
        imageRecord={optimizedImageRecord}
        title={title}
        onClick={onClick}
        className={className}
        size={tier}
      />
    );
  }

  // Fallback to SimpleArtworkImage for non-Cloudinary images
  return (
    <SimpleArtworkImage
      imageRecord={imageRecord}
      title={title}
      onClick={onClick}
      className={className}
      size={tier}
    />
  );
}
