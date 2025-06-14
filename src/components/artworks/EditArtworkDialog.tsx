
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
    enableKeyboardNavigation: true,
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
    const formElement = document.getElementById('edit-artwork-form') as HTMLFormElement;
    if (formElement) {
      const submitEvent = new Event('submit', {
        bubbles: true,
        cancelable: true,
      });
      formElement.dispatchEvent(submitEvent);
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
        className="max-h-[95vh] flex flex-col"
      >
        <ScrollableDialogHeader className="p-6 border-b">
          <ScrollableDialogTitle>Edit Artwork</ScrollableDialogTitle>
          <ScrollableDialogDescription>
            Update artwork details and manage attached images
          </ScrollableDialogDescription>
        </ScrollableDialogHeader>
        
        {/* Always force the dialog body as a scrollable flex column */}
        <ScrollableDialogBody 
          ref={scrollContainerRef}
          className="flex-1 min-h-0 px-4 md:px-8 py-6 bg-background space-y-8 overflow-auto"
        >
          <div className="mx-auto w-full max-w-2xl space-y-8">
            <div>
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
            </div>
            <div className="border-t pt-6">
              <h4 className="text-sm font-medium mb-4">Attached Images</h4>
              <div className="w-full">
                <ArtworkImageManager artworkId={artwork.id} />
              </div>
            </div>
          </div>
        </ScrollableDialogBody>
        
        <ScrollableDialogFooter className="bg-background/95 backdrop-blur px-6 py-4 border-t">
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

