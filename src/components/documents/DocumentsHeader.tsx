
import { DropZone } from "../uploads/DropZone";
import { UploadDocumentDialog } from "./UploadDocumentDialog";
import { useDocumentDropzone } from "./hooks/use-document-dropzone";

export function DocumentsHeader() {
  const {
    selectedFile,
    isOpen,
    isUploading,
    setIsUploading,
    onOpenChange,
    handleFileSelect
  } = useDocumentDropzone();
  
  return (
    <div className="space-y-4">
      <h1 className="text-3xl tracking-wide font-semibold text-slate-500">DOCUMENTS</h1>
      <div className="max-w-3xl">
        <DropZone 
          onFileSelect={handleFileSelect}
          disabled={isUploading}
        />
        <UploadDocumentDialog
          open={isOpen}
          onOpenChange={onOpenChange}
          selectedFile={selectedFile}
          setIsUploading={setIsUploading}
        />
      </div>
    </div>
  );
}
