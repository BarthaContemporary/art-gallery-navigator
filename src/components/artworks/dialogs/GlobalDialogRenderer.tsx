/**
 * Global Dialog Renderer - Single point for all artwork dialogs
 * Eliminates duplicate dialog instances and improves performance
 */

import React from "react";
import { useDialogManager } from "@/hooks/use-dialog-manager";
import { useArtworkActions } from "@/hooks/use-artwork-actions";
import { EnhancedArtworkOverviewDialog } from "../enhanced/EnhancedArtworkOverviewDialog";

// Import dialogs directly instead of lazy loading to avoid loading issues
// const ArtworkEditDialogLazy = lazy(() => 
//   import('../EditArtworkDialog').then(module => ({ 
//     default: module.EditArtworkDialog 
//   }))
// );

// const ArtworkDeleteDialogLazy = lazy(() => 
//   import('./ArtworkDeleteDialogHandler').then(module => ({ 
//     default: module.ArtworkDeleteDialogHandler 
//   }))
// );

export function GlobalDialogRenderer() {
  const { type, artwork, isOpen, isDeleting, closeDialog, setDeleting } = useDialogManager();
  
  // Always call hooks unconditionally - React hooks rule
  const artworkActions = useArtworkActions(artwork || {} as any);

  console.log("GlobalDialogRenderer render:", { type, isOpen, artworkId: artwork?.id });

  if (!isOpen || !artwork) {
    return null;
  }

  return (
    <>
      {type === 'overview' && (
        <EnhancedArtworkOverviewDialog
          artwork={artwork}
          open={isOpen}
          onOpenChange={(open) => {
            if (!open) closeDialog();
          }}
        />
      )}
      
      {/* Temporarily disable edit and delete dialogs to focus on overview */}
      {/* 
      {type === 'edit' && (
        <ArtworkEditDialogLazy
          artwork={artwork}
          open={isOpen}
          onOpenChange={(open) => {
            if (!open) closeDialog();
          }}
        />
      )}
      
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