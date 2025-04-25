
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreateArtworkForm } from "./CreateArtworkForm";
import { Artwork } from "@/hooks/use-artworks";

interface EditArtworkDialogProps {
  artwork: Artwork;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditArtworkDialog({ artwork, open, onOpenChange }: EditArtworkDialogProps) {
  const handleDialogInteraction = (e: React.MouseEvent) => {
    // Prevent event from bubbling up to parent elements
    e.stopPropagation();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh]"
        onClick={handleDialogInteraction}
      >
        <DialogHeader>
          <DialogTitle>Edit Artwork</DialogTitle>
          <DialogDescription>
            Make changes to your artwork information below.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[calc(90vh-8rem)] pr-4">
          <CreateArtworkForm 
            setOpen={onOpenChange} 
            initialData={artwork} 
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
