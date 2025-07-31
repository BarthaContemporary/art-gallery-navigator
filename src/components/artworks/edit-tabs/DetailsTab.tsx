import React, { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Artwork } from "@/hooks/use-artworks";
import { CreateArtworkFormRef } from "../CreateArtworkForm";

const CreateArtworkForm = lazy(() => import("../CreateArtworkForm").then(module => ({ default: module.CreateArtworkForm })));

interface DetailsTabProps {
  artwork: Artwork;
  formRef: React.RefObject<CreateArtworkFormRef>;
  setAutosaveStatus: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
}

export function DetailsTab({ artwork, formRef, setAutosaveStatus }: DetailsTabProps) {
  return (
    <div className="space-y-6">
      <Suspense fallback={
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }>
        <CreateArtworkForm
          ref={formRef}
          setOpen={() => {}} // No-op since we handle closing in parent
          initialData={artwork}
          enableAutosave={true}
          onAutosaveStatusChange={setAutosaveStatus}
        />
      </Suspense>
    </div>
  );
}