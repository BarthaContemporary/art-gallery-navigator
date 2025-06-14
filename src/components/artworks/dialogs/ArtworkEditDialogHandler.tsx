
import React, { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { Artwork } from "@/hooks/use-artworks";

const EditArtworkDialogLazy = lazy(() => import('../EditArtworkDialog').then(module => ({ default: module.EditArtworkDialog })));

interface ArtworkEditDialogHandlerProps {
  artwork: Artwork;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArtworkEditDialogHandler({ artwork, open, onOpenChange }: ArtworkEditDialogHandlerProps) {
  if (!open) return null;

  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>}>
      <EditArtworkDialogLazy
        artwork={artwork}
        open={open}
        onOpenChange={onOpenChange}
      />
    </Suspense>
  );
}
