
import { DropZone } from "../uploads/DropZone";
import { useDocumentUpload } from "./use-document-upload";

export function DocumentsHeader() {
  const { handleUpload, isUploading } = useDocumentUpload();
  
  return (
    <div className="space-y-4">
      <h1 className="text-3xl tracking-wide font-semibold text-slate-500">DOCUMENTS</h1>
      <div className="max-w-3xl">
        <DropZone 
          onFileSelect={handleUpload} 
          disabled={isUploading}
        />
      </div>
    </div>
  );
}
