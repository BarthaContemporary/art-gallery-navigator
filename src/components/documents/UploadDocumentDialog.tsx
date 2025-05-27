
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter, // Ensure DialogFooter is imported if used
} from "@/components/ui/dialog";
import { PlusCircle } from "lucide-react";
import { UploadDocumentForm } from "./UploadDocumentForm";
import { useDocumentUpload } from "./use-document-upload";
import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea

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

  // The form itself includes submit/cancel buttons, so DialogFooter might not be needed here
  // unless we move buttons out of UploadDocumentForm. Assuming buttons are in UploadDocumentForm.

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusCircle className="h-3 w-3 md:h-4 md:w-4" /> {/* Removed mr-2, standardized size */}
          Add Document
        </Button>
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-[425px] flex flex-col max-h-[90vh]" // Added flex flex-col and max-h
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
        <ScrollArea className="flex-grow p-1"> {/* Added ScrollArea wrapper */}
          <div className="py-4"> {/* Add padding if form doesn't have it */}
            <UploadDocumentForm form={form} onSubmit={handleUpload} isUploading={isUploading} />
          </div>
        </ScrollArea>
        {/* If UploadDocumentForm has its own footer/buttons, DialogFooter is not needed here.
            If buttons were meant to be in DialogFooter:
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isUploading}>Cancel</Button>
          <Button onClick={form.handleSubmit(handleUpload)} disabled={isUploading}>
            {isUploading ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter> 
        */}
      </DialogContent>
    </Dialog>
  );
}
