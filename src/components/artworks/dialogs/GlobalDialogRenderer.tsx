/**
 * Global Dialog Renderer - Single point for all artwork dialogs
 * Eliminates duplicate dialog instances and improves performance
 */

import React from "react";
import { useDialogManager } from "@/hooks/use-dialog-manager";
import { ArtworkOverviewDialog } from "../overview/ArtworkOverviewDialog";
import { EditArtworkDialog } from "../EditArtworkDialog";
import { DeleteDialogWithActions } from "./DeleteDialogWithActions";

export function GlobalDialogRenderer() {
  const { type, artwork, isOpen, isDeleting, closeDialog, setDeleting } = useDialogManager();

  if (!isOpen || !artwork) {
    return null;
  }

  return (
    <>
      {type === 'overview' && (
        <ArtworkOverviewDialog
          artwork={artwork}
          open={isOpen}
          onOpenChange={(open) => {
            if (!open) closeDialog();
          }}
        />
      )}
      
      {type === 'edit' && (
        <EditArtworkDialog
          artwork={artwork}
          open={isOpen}
          onOpenChange={(open) => {
            if (!open) closeDialog();
          }}
        />
      )}
      
      {type === 'delete' && (
        <DeleteDialogWithActions
          artwork={artwork}
          open={isOpen}
          onOpenChange={(open) => {
            if (!open) closeDialog();
          }}
          isDeleting={isDeleting || false}
          setDeleting={setDeleting}
          closeDialog={closeDialog}
        />
      )}
    </>
  );
}
