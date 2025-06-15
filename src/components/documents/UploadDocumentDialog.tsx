
import { Button } from "@/components/ui/button";
import {
  ScrollableDialog,
  ScrollableDialogContent,
  ScrollableDialogDescription,
  ScrollableDialogHeader,
  ScrollableDialogTitle,
  ScrollableDialogTrigger,
  ScrollableDialogBody,
  ScrollableDialogFooter,
} from "@/components/ui/scrollable-dialog";
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
    <ScrollableDialog open={open} onOpenChange={handleOpenChange}>
      <ScrollableDialogTrigger asChild>
        <Button size="sm">
          <PlusCircle className="h-3 w-3 md:h-4 md:w-4 mr-2" />
          Add Document
        </Button>
      </ScrollableDialogTrigger>
      <ScrollableDialogContent 
        size="md"
        onClick={(e) => e.stopPropagation()}
        onPointerDownOutside={e => {
          if (isUploading) {
            e.preventDefault();
          }
        }}
        className="p-0 flex flex-col max-h-[90vh]"
      >
        <ScrollableDialogHeader className="px-6 pt-6 pb-2 border-b">
          <ScrollableDialogTitle>Upload Document</ScrollableDialogTitle>
          <ScrollableDialogDescription>
            Attach a document to an artwork, collection, or artist. Please select exactly one.
          </ScrollableDialogDescription>
        </ScrollableDialogHeader>
        <ScrollableDialogBody className="flex-1 min-h-0 px-6 py-6">
          <UploadDocumentForm form={form} onSubmit={handleUpload} isUploading={isUploading} />
        </ScrollableDialogBody>
        <ScrollableDialogFooter />
      </ScrollableDialogContent>
    </ScrollableDialog>
  );
}
