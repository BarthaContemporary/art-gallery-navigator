
import React from "react";
import { LocalArtworkImageViewer } from "./LocalArtworkImageViewer";

interface ArtworkImageViewerProps {
  artworkId: string;
  artworkTitle: string;
}

export function ArtworkImageViewer({ artworkId, artworkTitle }: ArtworkImageViewerProps) {
  return <LocalArtworkImageViewer artworkId={artworkId} artworkTitle={artworkTitle} />;
}
