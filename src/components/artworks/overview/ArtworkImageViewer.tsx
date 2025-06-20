
import React from "react";
import { SimpleArtworkCarousel } from "../SimpleArtworkCarousel";

interface ArtworkImageViewerProps {
  artworkId: string;
  artworkTitle: string;
}

export function ArtworkImageViewer({ artworkId, artworkTitle }: ArtworkImageViewerProps) {
  return <SimpleArtworkCarousel artworkId={artworkId} artworkTitle={artworkTitle} />;
}
