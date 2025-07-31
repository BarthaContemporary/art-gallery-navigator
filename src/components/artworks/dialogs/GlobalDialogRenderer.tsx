/**
 * Global Dialog Renderer - Single point for all artwork dialogs
 * Eliminates duplicate dialog instances and improves performance
 */

import React, { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { useDialogManager } from "@/hooks/use-dialog-manager";
import { useArtworkActions } from "@/hooks/use-artwork-actions";

// Lazy load dialog components for better performance
const ArtworkOverviewDialogLazy = lazy(() => 
  import('../overview/ArtworkOverviewDialog').then(module => ({ 
    default: module.ArtworkOverviewDialog 
  }))
);

const ArtworkEditDialogLazy = lazy(() => 
  import('../EditArtworkDialog').then(module => ({ 
    default: module.EditArtworkDialog 
  }))
);

const ArtworkDeleteDialogLazy = lazy(() => 
  import('./ArtworkDeleteDialogHandler').then(module => ({ 
    default: module.ArtworkDeleteDialogHandler 
  }))
);

const DialogLoadingFallback = () => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <Loader2 className="h-8 w-8 animate-spin text-white" />
  </div>
);

export function GlobalDialogRenderer() {
  const { type, artwork, isOpen, isDeleting, closeDialog, setDeleting } = useDialogManager();
  
  // Only initialize artwork actions when needed
  const artworkActions = artwork ? useArtworkActions(artwork) : null;

  if (!isOpen || !artwork) {
    return null;
  }

  return (
    <Suspense fallback={<DialogLoadingFallback />}>
      {type === 'overview' && (
        <ArtworkOverviewDialogLazy
          artwork={artwork}
          open={isOpen}
          onOpenChange={(open) => {
            if (!open) closeDialog();
          }}
        />
      )}
      
      {type === 'edit' && (
        <ArtworkEditDialogLazy
          artwork={artwork}
          open={isOpen}
          onOpenChange={(open) => {
            if (!open) closeDialog();
          }}
        />
      )}
      
      {type === 'delete' && artworkActions && (
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
    </Suspense>
  );
}