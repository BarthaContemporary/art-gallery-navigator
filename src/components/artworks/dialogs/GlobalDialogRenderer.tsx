/**
 * Global Dialog Renderer - Single point for all artwork dialogs
 * Eliminates duplicate dialog instances and improves performance
 */

import React from "react";
import { useDialogManager } from "@/hooks/use-dialog-manager";
import { useArtworkActions } from "@/hooks/use-artwork-actions";
import { ArtworkOverviewDialog } from "../overview/ArtworkOverviewDialog";
import { EditArtworkDialog } from "../EditArtworkDialog";

export function GlobalDialogRenderer() {
  const { type, artwork, isOpen, isDeleting, closeDialog, setDeleting } = useDialogManager();
  
  // Always call hooks unconditionally - React hooks rule
  const artworkActions = useArtworkActions(artwork || {} as any);

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
      
      {/* Temporarily disable delete dialog */}
      {/* 
      {type === 'delete' && artworkActions && artwork && (
        <ArtworkDeleteDialogLazy
          artwork={artwork}
          open={isOpen}
          onOpenChange={(open) => {
            if (!open) closeDialog();
          }}
          isDeleting={isDeleting || false}
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
      )}
      */}
    </>
  );
}