
import React from "react";
import { Artwork } from "@/hooks/use-artworks";
import { ArtworkOverviewDialog as NewArtworkOverviewDialog } from "./overview/ArtworkOverviewDialog";

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
    <NewArtworkOverviewDialog
      artwork={artwork}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
