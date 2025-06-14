
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
import { ScrollArea } from "@/components/ui/scroll-area";

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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusCircle className="h-3 w-3 md:h-4 md:w-4 mr-2" />
          Add Document
        </Button>
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-[425px] flex flex-col max-h-[90vh] h-[90vh] min-h-0"
        onClick={(e) => e.stopPropagation()}
        onPointerDownOutside={e => {
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
        <ScrollArea className="flex-1 min-h-0 p-1">
          <div className="py-4">
            <UploadDocumentForm form={form} onSubmit={handleUpload} isUploading={isUploading} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
