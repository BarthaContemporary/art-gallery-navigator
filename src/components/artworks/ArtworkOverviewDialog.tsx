
import React from "react";
import { Artwork } from "@/hooks/use-artworks";
import { ArtworkDialog } from "./ArtworkDialog";

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
    <ArtworkDialog
      artwork={artwork}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
