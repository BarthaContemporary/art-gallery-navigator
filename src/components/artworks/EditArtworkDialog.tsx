
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
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
        className="max-w-2xl max-h-[90vh] flex flex-col"
        onClick={handleDialogInteraction}
        onPointerDownOutside={(e) => e.preventDefault()} // Prevent accidental outside clicks
      >
        <DialogHeader className="pt-10 flex-shrink-0">
          <DialogTitle>Edit Artwork</DialogTitle>
          <DialogDescription>
            Make changes to your artwork information below.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <div className="pb-4">
              <CreateArtworkForm 
                setOpen={onOpenChange} 
                initialData={artwork} 
                preventFreeze={true}
                hideSubmitButton={true}
              />
            </div>
          </ScrollArea>
        </div>
        
        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            form="edit-artwork-form"
          >
            Update Artwork
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
