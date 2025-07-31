import React, { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const ArtworkDocuments = lazy(() => import("../documents/ArtworkDocuments").then(module => ({ default: module.ArtworkDocuments })));

interface DocumentsTabProps {
  artworkId: string;
}

export function DocumentsTab({ artworkId }: DocumentsTabProps) {
  return (
    <div className="space-y-6">
      <Suspense fallback={
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }>
        <ArtworkDocuments artworkId={artworkId} />
      </Suspense>
    </div>
  );
}