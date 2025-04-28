
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
import { useDocumentUpload } from "./use-document-upload";
import React from "react";

export function UploadDocumentDialog() {
  const { form, handleUpload, isUploading, open, setOpen } = useDocumentUpload();

  const handleOpenChange = (newOpen: boolean) => {
    // Only allow closing if not currently uploading
    if (!isUploading) {
      setOpen(newOpen);
      
      // Reset form when dialog is closed
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-[425px]"
        onClick={(e) => e.stopPropagation()}
        onPointerDownOutside={e => {
          // Prevent closing during upload
          if (isUploading) {
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
        <UploadDocumentForm form={form} onSubmit={handleUpload} isUploading={isUploading} />
      </DialogContent>
    </Dialog>
  );
}
