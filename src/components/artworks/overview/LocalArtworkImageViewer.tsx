
import React from "react";
import { LocalArtworkCarousel } from "../LocalArtworkCarousel";

interface LocalArtworkImageViewerProps {
  artworkId: string;
  artworkTitle: string;
}

export function LocalArtworkImageViewer({ artworkId, artworkTitle }: LocalArtworkImageViewerProps) {
  return <LocalArtworkCarousel artworkId={artworkId} artworkTitle={artworkTitle} />;
}
