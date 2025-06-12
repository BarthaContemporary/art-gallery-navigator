
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PublicArtwork } from "@/hooks/artworks/useFetchArtworksByCollectionId";

interface PublicArtworkDialogProps {
  artwork: PublicArtwork | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showPrices?: boolean;
}

export function PublicArtworkDialog({
  artwork,
  open,
  onOpenChange,
  showPrices = true
}: PublicArtworkDialogProps) {
  if (!artwork) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[90vw] md:w-full max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 pt-10 sticky top-0 bg-background z-10 border-b">
          <DialogTitle className="text-2xl font-semibold text-left">
            {artwork.title}
          </DialogTitle>
          {artwork.artist && (
            <p className="text-lg text-muted-foreground">
              {artwork.artist.full_name}
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Artwork Details</h3>
              <p className="text-gray-500">Coming soon...</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
