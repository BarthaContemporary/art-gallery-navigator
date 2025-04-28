
import React, { Dispatch, SetStateAction, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UploadDocumentForm } from "./UploadDocumentForm";
import { useDocumentUpload } from "./use-document-upload";

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFile: File | null;
  setIsUploading: Dispatch<SetStateAction<boolean>>;
}

export function UploadDocumentDialog({ 
  open, 
  onOpenChange, 
  selectedFile,
  setIsUploading 
}: UploadDocumentDialogProps) {
  const { form, handleUpload, isUploading } = useDocumentUpload();

  // Update parent's uploading state
  useEffect(() => {
    setIsUploading(isUploading);
  }, [isUploading, setIsUploading]);

  // Set the selected file in the form when dialog opens
  useEffect(() => {
    if (selectedFile) {
      form.setValue("file", selectedFile);
    }
  }, [selectedFile, form]);

  const handleOpenChange = (newOpen: boolean) => {
    // Only allow closing if not currently uploading
    if (!isUploading) {
      onOpenChange(newOpen);
      
      // Reset form when dialog is closed
      if (!newOpen) {
        form.reset({
          description: "",
          artwork_id: "_none",
          collection_id: "_none",
          artist_id: "",
          type: "",
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
        <UploadDocumentForm 
          form={form} 
          onSubmit={handleUpload} 
          isUploading={isUploading}
        />
      </DialogContent>
    </Dialog>
  );
}
