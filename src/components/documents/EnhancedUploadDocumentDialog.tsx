
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PlusCircle } from "lucide-react";
import { UploadDocumentForm } from "./UploadDocumentForm";
import { UploadProgress } from "./UploadProgress";
import { RetryButton } from "./RetryButton";
import { useEnhancedDocumentUpload } from "@/hooks/use-enhanced-document-upload";
import { ScrollArea } from "@/components/ui/scroll-area";

export function EnhancedUploadDocumentDialog() {
  const { 
    form, 
    open, 
    setOpen, 
    handleUpload, 
    handleRetry,
    uploadStatus,
    uploadProgress,
    uploadError
  } = useEnhancedDocumentUpload();

  const handleOpenChange = (newOpen: boolean) => {
    // Only allow closing if not currently uploading
    if (uploadStatus !== 'uploading') {
      setOpen(newOpen);
      
      if (!newOpen) {
        setTimeout(() => {
          form.reset({
            description: "",
            artwork_id: "_none",
            collection_id: "_none",
            artist_id: "",
            type: "",
            file: undefined
          });
        }, 100);
      }
    }
  };

  const currentFileName = form.watch('file')?.name;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusCircle className="h-3 w-3 md:h-4 md:w-4 mr-2" />
          Add Document
        </Button>
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-[425px] flex flex-col max-h-[calc(100dvh-5rem)]"
        onPointerDownOutside={e => {
          if (uploadStatus === 'uploading') {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Attach a document to an artwork, collection, or artist. Please select exactly one.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0 p-1">
          <div className="space-y-4">
            {/* Upload Progress */}
            <UploadProgress
              progress={uploadProgress}
              status={uploadStatus}
              fileName={currentFileName}
              error={uploadError}
            />
            
            {/* Upload Form */}
            <UploadDocumentForm 
              form={form} 
              onSubmit={handleUpload} 
              isUploading={uploadStatus === 'uploading'} 
            />
            
            {/* Retry Button for Failed Uploads */}
            {uploadStatus === 'error' && (
              <div className="flex justify-center pt-2">
                <RetryButton onRetry={handleRetry} />
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
