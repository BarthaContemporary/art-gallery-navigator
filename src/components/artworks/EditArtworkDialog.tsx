
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { scrollContainerRef, scrollToFirstError } = useScrollableDialog(open, {
    restoreScrollPosition: true,
    scrollToErrorOnValidation: true,
    enableKeyboardNavigation: true
  });

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!isMounted) return;
    
    if (newOpen === false) {
      setIsSubmitting(false);
      window.requestAnimationFrame(() => {
        onOpenChange(false);
      });
    } else {
      onOpenChange(true);
    }
  }, [onOpenChange, isMounted]);

  const handleFormSubmit = useCallback(() => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    // Find the form and trigger submission
    const formElement = document.getElementById('edit-artwork-form') as HTMLFormElement;
    if (formElement) {
      // Create a submit event
      const submitEvent = new Event('submit', {
        bubbles: true,
        cancelable: true,
      });
      
      // Dispatch the event to trigger form validation and submission
      formElement.dispatchEvent(submitEvent);
      
      // Small delay to allow validation to complete before scrolling
      setTimeout(() => {
        const errorElement = formElement.querySelector('[aria-invalid="true"]');
        if (errorElement) {
          scrollToFirstError();
        }
        setIsSubmitting(false);
      }, 100);
    } else {
      setIsSubmitting(false);
    }
  }, [scrollToFirstError, isSubmitting]);

  return (
    <ScrollableDialog open={open} onOpenChange={handleOpenChange}>
      <ScrollableDialogContent 
        size="2xl"
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
              onSuccessCallback={() => {
                setIsSubmitting(false);
                handleOpenChange(false);
              }}
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
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            type="button"
            onClick={handleFormSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Updating..." : "Update Artwork"}
          </Button>
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </ScrollableDialog>
  );
}
