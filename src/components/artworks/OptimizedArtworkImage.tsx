
import React from "react";
import type { ArtworkImage } from "@/hooks/use-artworks";
import { CloudinaryArtworkImage } from "./CloudinaryArtworkImage";

interface OptimizedArtworkImageProps {
  imageRecord?: ArtworkImage;
  title: string;
  onClick?: () => void;
  className?: string;
  tier?: 'thumbnail' | 'medium' | 'full';
  onLoadingStart?: () => void;
  onLoadingComplete?: () => void;
}

export function OptimizedArtworkImage(props: OptimizedArtworkImageProps) {
  // Simply delegate to the new Cloudinary component
  return <CloudinaryArtworkImage {...props} />;
}
