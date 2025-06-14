
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
  // const [isSubmitting, setIsSubmitting] = useState(false); // Removed local submitting state
  const [isFormActuallySaving, setIsFormActuallySaving] = useState(false);

  const { scrollContainerRef, scrollToFirstError } = useScrollableDialog(open, {
    restoreScrollPosition: true,
    scrollToErrorOnValidation: true, // This option exists but we will ensure explicit call
    enableKeyboardNavigation: true,
  });

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!isMounted) return;
    if (newOpen === false) {
      setIsFormActuallySaving(false); // Reset saving state on close
      window.requestAnimationFrame(() => {
        onOpenChange(false);
      });
    } else {
      onOpenChange(true);
    }
  }, [onOpenChange, isMounted]);

  // Removed handleFormSubmit function

  return (
    <ScrollableDialog open={open} onOpenChange={handleOpenChange}>
      <ScrollableDialogContent 
        size="2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        className="flex flex-col max-h-[95vh] min-h-0 h-full"
      >
        <ScrollableDialogHeader className="p-6 border-b">
          <ScrollableDialogTitle>Edit Artwork</ScrollableDialogTitle>
          <ScrollableDialogDescription>
            Update artwork details and manage attached images
          </ScrollableDialogDescription>
        </ScrollableDialogHeader>
        <div className="flex-1 min-h-0 flex flex-col">
          <ScrollableDialogBody
            ref={scrollContainerRef}
            className="flex-1 min-h-0 overflow-auto px-4 md:px-8 py-6 bg-background space-y-8"
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
                    setIsFormActuallySaving(false); // Reset on success
                    handleOpenChange(false);
                  }}
                  onSavingChange={setIsFormActuallySaving} // Pass callback to update loading state
                  scrollToFirstError={scrollToFirstError} // Pass scroll function
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
        </div>
        <ScrollableDialogFooter className="px-6 py-4 border-t bg-background/95 backdrop-blur">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => handleOpenChange(false)}
            disabled={isFormActuallySaving} // Use new loading state
          >
            Cancel
          </Button>
          <Button 
            type="submit" // Changed to submit
            form="edit-artwork-form" // Associate with the form
            // onClick removed
            disabled={isFormActuallySaving} // Use new loading state
          >
            {isFormActuallySaving ? "Updating..." : "Update Artwork"}
          </Button>
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </ScrollableDialog>
  );
}
