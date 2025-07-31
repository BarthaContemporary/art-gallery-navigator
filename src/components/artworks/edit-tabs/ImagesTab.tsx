import React, { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const LocalImageUploader = lazy(() => import("../LocalImageUploader").then(module => ({ default: module.LocalImageUploader })));
const LocalArtworkImageManager = lazy(() => import("../LocalArtworkImageManager").then(module => ({ default: module.LocalArtworkImageManager })));
const TargetedImageSearch = lazy(() => import("../form/TargetedImageSearch").then(module => ({ default: module.TargetedImageSearch })));

interface ImagesTabProps {
  artworkId: string;
  onImageUploadComplete: () => void;
  onArtsyImageSelected: (urls: string[]) => Promise<void>;
}

export function ImagesTab({ artworkId, onImageUploadComplete, onArtsyImageSelected }: ImagesTabProps) {
  return (
    <div className="space-y-6">
      <Suspense fallback={
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }>
        <div className="space-y-4">
          <LocalImageUploader 
            artworkId={artworkId}
            onUploadComplete={onImageUploadComplete}
          />
          
          <LocalArtworkImageManager artworkId={artworkId} />
          
          <TargetedImageSearch 
            onImageSelected={onArtsyImageSelected}
          />
        </div>
      </Suspense>
    </div>
  );
}