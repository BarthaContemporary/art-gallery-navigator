
import React from "react";
import { Artwork } from "@/hooks/use-artworks";
import { UnifiedImage } from "@/components/ui/unified-image";

interface SimpleArtworkImageProps {
  artwork: Artwork;
  className?: string;
}

export function SimpleArtworkImage({ artwork, className }: SimpleArtworkImageProps) {
  return (
    <UnifiedImage
      artwork={artwork}
      tier="medium"
      className={className}
      alt={artwork.title}
      priority={false}
    />
  );
}
