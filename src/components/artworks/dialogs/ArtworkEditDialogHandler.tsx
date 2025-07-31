
import React from "react";
import { Artwork } from "@/hooks/use-artworks";
import { EditArtworkDialog } from "../EditArtworkDialog";

interface ArtworkEditDialogHandlerProps {
  artwork: Artwork;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArtworkEditDialogHandler({ artwork, open, onOpenChange }: ArtworkEditDialogHandlerProps) {
  if (!open) return null;

  return (
    <EditArtworkDialog
      artwork={artwork}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
