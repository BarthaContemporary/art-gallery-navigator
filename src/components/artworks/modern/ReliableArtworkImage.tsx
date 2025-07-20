
/**
 * Reliable Artwork Image Component for Modern UI
 * Uses the unified image system for consistent behavior
 */

import React from "react";
import { Artwork } from "@/hooks/use-artworks";
import { UnifiedImage } from "@/components/ui/unified-image";

interface ReliableArtworkImageProps {
  artwork: Artwork;
  tier?: 'thumbnail' | 'medium' | 'large' | 'original';
  className?: string;
  alt?: string;
  priority?: boolean;
  onClick?: () => void;
}

export function ReliableArtworkImage({
  artwork,
  tier = 'medium',
  className,
  alt,
  priority = false,
  onClick
}: ReliableArtworkImageProps) {
  return (
    <UnifiedImage
      artwork={artwork}
      tier={tier}
      className={className}
      alt={alt}
      priority={priority}
      onClick={onClick}
    />
  );
}
