
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

export function UploadDocumentDialog() {
  const { form, open, setOpen, handleUpload, isUploading } = useDocumentUpload();

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      // Only allow closing if not currently uploading
      if (!isUploading) {
        setOpen(newOpen);
        if (!newOpen) {
          // Reset form when dialog is closed
          form.reset({
            description: "",
            artwork_id: "_none",
            collection_id: "_none",
            artist_id: "",
            type: "",
            file: undefined
          });
        }
      }
    }}>
      <DialogTrigger asChild>
        <Button onClick={() => setOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Upload Document
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Attach a document to an artwork, collection, or artist. Please select exactly one.
          </DialogDescription>
        </DialogHeader>
        <UploadDocumentForm form={form} onSubmit={handleUpload} />
      </DialogContent>
    </Dialog>
  );
}
