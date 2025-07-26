
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateArtworkForm } from "./CreateArtworkForm";
import { VideoUploadFields } from "./form/VideoUploadFields";
import { ArtworkDocuments } from "./documents/ArtworkDocuments";
import { Artwork } from "@/hooks/use-artworks";
import { useCallback, useEffect, useState } from "react";
import { useScrollableDialog } from "@/hooks/use-scrollable-dialog";
import { LocalImageUploader } from "./LocalImageUploader";
import { LocalArtworkImageManager } from "./LocalArtworkImageManager";
import { useLocalArtworkImages } from "@/hooks/use-local-artwork-images";
import { ArtsyImageSearch } from "./form/ArtsyImageSearch";
import { useImageUpload } from "./form/useImageUpload";
import { useForm } from "react-hook-form";
import { ArtworkFormData } from "./form/types";

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

  // Get the refresh function from the images hook
  const { refreshImages } = useLocalArtworkImages(artwork.id);

  // Form for handling Artsy image selection
  const form = useForm<ArtworkFormData>();
  const { handleArtsyImageSelected } = useImageUpload(form);

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

  const handleUpdateArtwork = useCallback(() => {
    // Trigger form submission by clicking the hidden submit button
    const form = document.getElementById('edit-artwork-form');
    if (form) {
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);
    }
  }, []);

  const handleImageUploadComplete = useCallback(() => {
    // Refresh the images list when upload completes
    refreshImages();
  }, [refreshImages]);

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
            Update artwork details and manage media files
          </ScrollableDialogDescription>
        </ScrollableDialogHeader>
        <ScrollableDialogBody ref={scrollContainerRef}>
          <div className="px-6 pt-6 pb-6">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="images">Images</TabsTrigger>
                <TabsTrigger value="videos">Videos</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="mt-6">
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
              </TabsContent>
              
              <TabsContent value="images" className="mt-6 space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium">Upload New Images</h4>
                    <ArtsyImageSearch
                      onImageSelected={(url) => {
                        handleArtsyImageSelected(url);
                        // You could also trigger an upload to your system here if needed
                        console.log('Selected Artsy image:', url);
                      }}
                      defaultArtist={artwork.artists?.full_name}
                      defaultTitle={artwork.title}
                      defaultYear={artwork.year}
                    />
                  </div>
                  <LocalImageUploader 
                    artworkId={artwork.id}
                    onUploadComplete={handleImageUploadComplete}
                  />
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-4">Manage Images</h4>
                  <LocalArtworkImageManager artworkId={artwork.id} />
                </div>
              </TabsContent>
              
              <TabsContent value="videos" className="mt-6">
                <VideoUploadFields artworkId={artwork.id} />
              </TabsContent>

              <TabsContent value="documents" className="mt-6">
                <ArtworkDocuments artworkId={artwork.id} />
              </TabsContent>
            </Tabs>
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
            type="button"
            onClick={handleUpdateArtwork}
            disabled={isFormActuallySaving}
          >
            {isFormActuallySaving ? "Updating..." : "Update Artwork"}
          </Button>
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </ScrollableDialog>
  );
}
