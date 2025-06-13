
import {
  ScrollableDialog,
  ScrollableDialogContent,
  ScrollableDialogHeader,
  ScrollableDialogTitle,
  ScrollableDialogDescription,
  ScrollableDialogBody,
  ScrollableDialogFooter,
} from "@/components/ui/scrollable-dialog";
import { Button } from "@/components/ui/button";
import { CreateArtworkForm } from "./CreateArtworkForm";
import { ArtworkImageManager } from "./ArtworkImageManager";
import { Artwork } from "@/hooks/use-artworks";
import { useCallback, useEffect, useState } from "react";
import { useScrollableDialog } from "@/hooks/use-scrollable-dialog";

interface EditArtworkDialogProps {
  artwork: Artwork;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditArtworkDialog({ artwork, open, onOpenChange }: EditArtworkDialogProps) {
  const [isMounted, setIsMounted] = useState(false);
  
  const { scrollContainerRef, scrollToFirstError } = useScrollableDialog(open, {
    restoreScrollPosition: true,
    scrollToErrorOnValidation: true,
    enableKeyboardNavigation: true
  });

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const handleDialogInteraction = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!isMounted) return;
    
    if (newOpen === false) {
      window.requestAnimationFrame(() => {
        onOpenChange(false);
      });
    } else {
      onOpenChange(true);
    }
  }, [onOpenChange, isMounted]);

  const handleFormSubmit = useCallback(() => {
    // Trigger form submission and scroll to first error if validation fails
    const form = document.getElementById('edit-artwork-form') as HTMLFormElement;
    if (form) {
      form.requestSubmit();
      // Small delay to allow validation to complete before scrolling
      setTimeout(() => {
        scrollToFirstError();
      }, 100);
    }
  }, [scrollToFirstError]);

  return (
    <ScrollableDialog open={open} onOpenChange={handleOpenChange}>
      <ScrollableDialogContent 
        size="2xl"
        onClick={handleDialogInteraction}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <ScrollableDialogHeader>
          <ScrollableDialogTitle>Edit Artwork</ScrollableDialogTitle>
          <ScrollableDialogDescription>
            Update artwork details and manage attached images
          </ScrollableDialogDescription>
        </ScrollableDialogHeader>
        
        <ScrollableDialogBody ref={scrollContainerRef}>
          <div className="space-y-6">
            <CreateArtworkForm 
              setOpen={onOpenChange} 
              initialData={artwork} 
              preventFreeze={true}
              hideSubmitButton={true}
              formId="edit-artwork-form"
            />
            
            <div className="border-t pt-6">
              <h4 className="text-sm font-medium mb-4">Attached Images</h4>
              <ArtworkImageManager artworkId={artwork.id} />
            </div>
          </div>
        </ScrollableDialogBody>
        
        <ScrollableDialogFooter>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button 
            type="button"
            onClick={handleFormSubmit}
          >
            Update Artwork
          </Button>
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </ScrollableDialog>
  );
}
