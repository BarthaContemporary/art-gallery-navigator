
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
  const [isFormActuallySaving, setIsFormActuallySaving] = useState(false);

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
      setIsFormActuallySaving(false);
      window.requestAnimationFrame(() => {
        onOpenChange(false);
      });
    } else {
      onOpenChange(true);
    }
  }, [onOpenChange, isMounted]);

  return (
    <ScrollableDialog open={open} onOpenChange={handleOpenChange}>
      <ScrollableDialogContent
        size="2xl"
        className="flex flex-col max-h-[90vh] bg-background"
        onPointerDownOutside={e => e.preventDefault()}
      >
        <ScrollableDialogHeader className="px-6 pt-6 pb-2 border-b bg-background flex-shrink-0">
          <ScrollableDialogTitle>Edit Artwork</ScrollableDialogTitle>
          <ScrollableDialogDescription>
            Update artwork details and manage attached images
          </ScrollableDialogDescription>
        </ScrollableDialogHeader>
        <ScrollableDialogBody
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto bg-background px-6 py-6"
        >
          <div className="space-y-8">
            <CreateArtworkForm
              setOpen={onOpenChange}
              initialData={artwork}
              preventFreeze={true}
              hideSubmitButton={true}
              formId="edit-artwork-form"
              onSuccessCallback={() => {
                setIsFormActuallySaving(false);
                handleOpenChange(false);
              }}
              onSavingChange={setIsFormActuallySaving}
              scrollToFirstError={scrollToFirstError}
            />
            <div className="border-t pt-6 mt-6">
              <h4 className="text-sm font-medium mb-4">Attached Images</h4>
              <ArtworkImageManager artworkId={artwork.id} />
            </div>
          </div>
        </ScrollableDialogBody>
        <ScrollableDialogFooter className="bg-background flex-shrink-0 z-10">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isFormActuallySaving}
            className="mr-2"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-artwork-form"
            disabled={isFormActuallySaving}
          >
            {isFormActuallySaving ? "Updating..." : "Update Artwork"}
          </Button>
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </ScrollableDialog>
  );
}
