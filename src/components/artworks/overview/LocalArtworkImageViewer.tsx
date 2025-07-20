
import React from "react";
import { UnifiedImage } from "@/components/ui/unified-image";
import { useArtwork } from "@/hooks/use-artworks";

interface LocalArtworkImageViewerProps {
  artworkId: string;
  artworkTitle: string;
  imageUrl?: string;
  className?: string;
}

export function LocalArtworkImageViewer({ 
  artworkId, 
  artworkTitle, 
  imageUrl, 
  className 
}: LocalArtworkImageViewerProps) {
  const { data: artwork, isLoading } = useArtwork(artworkId);

  if (isLoading) {
    return (
      <div className={`w-full h-full bg-muted/20 flex items-center justify-center ${className}`}>
        <div className="text-center text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!artwork) {
    return (
      <div className={`w-full h-full bg-muted/20 flex items-center justify-center ${className}`}>
        <div className="text-center text-muted-foreground">
          <p className="text-sm">Artwork not found</p>
        </div>
      </div>
    );
  }

  return (
    <UnifiedImage
      artwork={artwork}
      tier="large"
      className={className}
      alt={artworkTitle}
      priority={true}
      showErrorDetails={true}
    />
  );
}
