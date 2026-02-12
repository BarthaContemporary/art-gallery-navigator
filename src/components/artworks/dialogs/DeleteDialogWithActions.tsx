import React from "react";
import { Artwork } from "@/hooks/use-artworks";
import { useArtworkActions } from "@/hooks/use-artwork-actions";
import { ArtworkDeleteDialogHandler } from "./ArtworkDeleteDialogHandler";

interface DeleteDialogWithActionsProps {
  artwork: Artwork;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDeleting: boolean;
  setDeleting: (v: boolean) => void;
  closeDialog: () => void;
}

export function DeleteDialogWithActions({
  artwork,
  open,
  onOpenChange,
  isDeleting,
  setDeleting,
  closeDialog,
}: DeleteDialogWithActionsProps) {
  const artworkActions = useArtworkActions(artwork);

  return (
    <ArtworkDeleteDialogHandler
      artwork={artwork}
      open={open}
      onOpenChange={onOpenChange}
      isDeleting={isDeleting}
      confirmDelete={async () => {
        setDeleting(true);
        try {
          await artworkActions.handleDelete();
          closeDialog();
        } catch (error) {
          setDeleting(false);
          throw error;
        }
      }}
    />
  );
}
