
import React from "react";
import { LocalArtworkImageViewer } from "./LocalArtworkImageViewer";

interface ArtworkImageViewerProps {
  artworkId: string;
  artworkTitle: string;
  imageUrl?: string;
  className?: string;
}

export function ArtworkImageViewer({ artworkId, artworkTitle, imageUrl, className }: ArtworkImageViewerProps) {
  return (
    <LocalArtworkImageViewer 
      artworkId={artworkId} 
      artworkTitle={artworkTitle} 
      imageUrl={imageUrl}
      className={className}
    />
  );
}
