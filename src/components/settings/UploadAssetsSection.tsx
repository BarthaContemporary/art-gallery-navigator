
import { FileUploader } from "@/components/uploads/FileUploader";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export function UploadAssetsSection() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Upload Assets</h2>
      
      <div className="bg-card rounded-lg shadow">
        <ErrorBoundary>
          <FileUploader />
        </ErrorBoundary>
      </div>
    </div>
  );
}
