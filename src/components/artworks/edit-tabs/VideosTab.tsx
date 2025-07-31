import React, { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const VideoUploadFields = lazy(() => import("../form/VideoUploadFields").then(module => ({ default: module.VideoUploadFields })));

interface VideosTabProps {
  artworkId: string;
}

export function VideosTab({ artworkId }: VideosTabProps) {
  return (
    <div className="space-y-6">
      <Suspense fallback={
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }>
        <VideoUploadFields artworkId={artworkId} />
      </Suspense>
    </div>
  );
}