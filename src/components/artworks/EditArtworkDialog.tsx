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
import { supabase } from "@/integrations/supabase/client";

interface EditArtworkDialogProps {
  artwork: Artwork;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Major rewrite: strict header/body/footer layout with stable scroll, responsive for mobile/desktop.
 * Layout: 
 * - DialogContent: flex-col, max-h-[90vh]
 *   - Header (fixed)
 *   - Body (scrolls)
 *   - Footer (fixed)
 * Body content gets all vertical padding via content wrapper.
 */
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
        <ScrollableDialogBody ref={scrollContainerRef}>
          <div className="space-y-8 px-6 pt-6 pb-6">
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
            {/* -- New: Upload Additional Images (above attached images) -- */}
            <div className="border-t pt-6 mt-6">
              <h4 className="text-sm font-medium mb-4">Upload Additional Images</h4>
              <div className="mb-6">
                <ArtworkAdditionalImageUploader artworkId={artwork.id} />
              </div>
              <h4 className="text-sm font-medium mb-4">Attached Images</h4>
              <ArtworkImageManager artworkId={artwork.id} />
            </div>
          </div>
        </ScrollableDialogBody>
        <ScrollableDialogFooter className="bg-background flex-shrink-0 z-10 border-t">
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

// New component: ArtworkAdditionalImageUploader
import { MultipleImageUploader } from "./MultipleImageUploader";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

function ArtworkAdditionalImageUploader({ artworkId }: { artworkId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const handleAdditionalImagesUploaded = async (urls: string[]) => {
    // Use Supabase to insert new artwork_images for each url
    // This is simplified and assumes a Supabase client called `supabase` exists
    for (const url of urls) {
      const { error } = await supabase
        .from('artwork_images')
        .insert({ artwork_id: artworkId, image_url: url, is_primary: false });
      if (error) {
        toast({
          title: "Error",
          description: "Failed to save uploaded image.",
          variant: "destructive",
        });
        return;
      }
    }
    toast({
      title: "Success",
      description: `${urls.length} image(s) added!`,
    });
    // Invalidate queries to refresh the image manager list
    queryClient.invalidateQueries({ queryKey: ['artwork-images', artworkId] });
    queryClient.invalidateQueries({ queryKey: ['artworks', artworkId] });
  };
  return (
    <MultipleImageUploader onImagesUploaded={handleAdditionalImagesUploaded} />
  );
}
