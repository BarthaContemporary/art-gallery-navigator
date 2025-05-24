
import React from 'react';
import { FileUploader } from "@/components/uploads/FileUploader";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function Upload() {
  return (
    <div className="container max-w-2xl mx-auto py-8">
      {/* Removed h1 title: <h1 className="text-sm font-visby font-extrabold text-slate-700">UPLOAD FILES</h1> */}
      <div className="bg-card rounded-lg shadow">
        <ErrorBoundary>
          <FileUploader />
        </ErrorBoundary>
      </div>
    </div>
  );
}

