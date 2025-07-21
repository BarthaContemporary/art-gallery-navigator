
import React from "react";
import { LocalArtworkCarousel } from "../LocalArtworkCarousel";

interface ArtworkImageViewerProps {
  artworkId: string;
  artworkTitle: string;
  imageUrl?: string;
  className?: string;
}

export function ArtworkImageViewer({ artworkId, artworkTitle, imageUrl, className }: ArtworkImageViewerProps) {
  return (
    <div className={`w-full h-[60vh] max-h-[500px] min-h-[300px] ${className}`}>
      <LocalArtworkCarousel 
        artworkId={artworkId} 
        artworkTitle={artworkTitle} 
      />
    </div>
  );
}
