
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreateArtworkForm } from "./CreateArtworkForm";
import { Artwork } from "@/hooks/use-artworks";

interface EditArtworkDialogProps {
  artwork: Artwork;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditArtworkDialog({ artwork, open, onOpenChange }: EditArtworkDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Edit Artwork</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[calc(90vh-8rem)] pr-4">
          <CreateArtworkForm setOpen={onOpenChange} initialData={artwork} />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
