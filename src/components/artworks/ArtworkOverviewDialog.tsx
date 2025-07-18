
import React from "react";
import { Artwork } from "@/hooks/use-artworks";
import { EnhancedArtworkOverviewDialog } from "./enhanced/EnhancedArtworkOverviewDialog";

interface ArtworkOverviewDialogProps {
  artwork: Artwork;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArtworkOverviewDialog({
  artwork,
  open,
  onOpenChange,
}: ArtworkOverviewDialogProps) {
  return (
    <EnhancedArtworkOverviewDialog
      artwork={artwork}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
