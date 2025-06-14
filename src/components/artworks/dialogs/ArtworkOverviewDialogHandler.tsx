
import React, { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { Artwork } from "@/hooks/use-artworks";

const ArtworkOverviewDialogLazy = lazy(() => import('../overview/ArtworkOverviewDialog').then(module => ({ default: module.ArtworkOverviewDialog })));

interface ArtworkOverviewDialogHandlerProps {
  artwork: Artwork;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArtworkOverviewDialogHandler({ artwork, open, onOpenChange }: ArtworkOverviewDialogHandlerProps) {
  if (!open) return null;

  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>}>
      <ArtworkOverviewDialogLazy
        artwork={artwork}
        open={open}
        onOpenChange={onOpenChange}
      />
    </Suspense>
  );
}
