
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreateArtworkForm } from "./CreateArtworkForm";
import { Artwork } from "@/hooks/use-artworks";
import { useCallback, useEffect, useState } from "react";

interface EditArtworkDialogProps {
  artwork: Artwork;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditArtworkDialog({ artwork, open, onOpenChange }: EditArtworkDialogProps) {
  // Track mount state to prevent issues with animation frames
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Use a memoized handler to prevent re-renders
  const handleDialogInteraction = useCallback((e: React.MouseEvent) => {
    // Prevent event from bubbling up to parent elements
    e.stopPropagation();
  }, []);

  // Memoized handler for dialog close to prevent state issues
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!isMounted) return;
    
    if (newOpen === false) {
      // Add a slight delay when closing to ensure state is properly handled
      window.requestAnimationFrame(() => {
        onOpenChange(false);
      });
    } else {
      onOpenChange(true);
    }
  }, [onOpenChange, isMounted]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh]"
        onClick={handleDialogInteraction}
        onPointerDownOutside={(e) => e.preventDefault()} // Prevent accidental outside clicks
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
            preventFreeze={true}
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
