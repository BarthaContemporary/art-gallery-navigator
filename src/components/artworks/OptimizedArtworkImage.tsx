
import React from "react";
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
