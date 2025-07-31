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
import { CreateArtworkFormRef } from "./CreateArtworkForm";
import { Artwork } from "@/hooks/use-artworks";
import { useCallback, useEffect, useState, useRef } from "react";
import { useScrollableDialog } from "@/hooks/use-scrollable-dialog";
import { useLocalArtworkImages } from "@/hooks/use-local-artwork-images";
import { ImageUploadService } from "@/services/image-upload-service";
import { toast } from "sonner";
import { AutosaveIndicator } from "@/components/ui/autosave-indicator";
import { DetailsTab } from "./edit-tabs/DetailsTab";
import { ImagesTab } from "./edit-tabs/ImagesTab";
import { VideosTab } from "./edit-tabs/VideosTab";
import { DocumentsTab } from "./edit-tabs/DocumentsTab";

interface EditArtworkDialogProps {
  artwork: Artwork;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditArtworkDialog({ artwork, open, onOpenChange }: EditArtworkDialogProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isFormActuallySaving, setIsFormActuallySaving] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const formRef = useRef<CreateArtworkFormRef>(null);

  const { scrollContainerRef, scrollToFirstError } = useScrollableDialog(open, {
    restoreScrollPosition: true,
    scrollToErrorOnValidation: true,
    enableKeyboardNavigation: true,
  });

  // Get the refresh function from the images hook
  const { refreshImages } = useLocalArtworkImages(artwork.id);

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
    console.log("handleUpdateArtwork called, activeTab:", activeTab);
    
    if (activeTab === "details") {
      console.log("Triggering form submission via ref");
      if (formRef.current) {
        formRef.current.submitForm();
      } else {
        console.error("Form ref not available");
      }
    } else {
      // For other tabs (images, videos, documents), just close the dialog
      // since uploads are handled immediately when they occur
      toast.success("Changes saved successfully");
      handleOpenChange(false);
    }
  }, [activeTab, handleOpenChange]);

  const handleImageUploadComplete = useCallback(() => {
    // Refresh the images list when upload completes
    refreshImages();
  }, [refreshImages]);

  const handleArtsyImageSelected = useCallback(async (urls: string[]) => {
    try {
      toast.loading(`Downloading and uploading ${urls.length} image(s)...`);
      
      let successCount = 0;
      
      // Process each URL
      for (const url of urls) {
        try {
          // Fetch the external image
          const response = await fetch(url);
          if (!response.ok) throw new Error('Failed to fetch image');
          
          const blob = await response.blob();
          
          // Create a file from the blob
          const filename = `external-image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${blob.type.split('/')[1] || 'jpg'}`;
          const file = new File([blob], filename, { type: blob.type });
          
          // Upload using the ImageUploadService
          const result = await ImageUploadService.uploadAndProcessImage(file, artwork.id, true, 0);
          
          if (result.success) {
            successCount++;
          }
        } catch (error) {
          console.error('Error uploading individual image:', error);
        }
      }
      
      toast.dismiss();
      if (successCount === urls.length) {
        toast.success(`All ${successCount} images uploaded successfully`);
      } else if (successCount > 0) {
        toast.success(`${successCount} of ${urls.length} images uploaded successfully`);
      } else {
        toast.error("Failed to upload any images");
      }
      
      // Refresh the images list
      refreshImages();
    } catch (error) {
      console.error('Error uploading external images:', error);
      toast.dismiss();
      toast.error("Failed to upload images. Please try again.");
    }
  }, [artwork.id, refreshImages]);

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
            <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="images">Images</TabsTrigger>
                <TabsTrigger value="videos">Videos</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="mt-6">
                <DetailsTab
                  artwork={artwork}
                  formRef={formRef}
                  setAutosaveStatus={setAutosaveStatus}
                />
              </TabsContent>

              <TabsContent value="images" className="mt-6">
                <ImagesTab
                  artworkId={artwork.id}
                  onImageUploadComplete={handleImageUploadComplete}
                  onArtsyImageSelected={handleArtsyImageSelected}
                />
              </TabsContent>

              <TabsContent value="videos" className="mt-6">
                <VideosTab artworkId={artwork.id} />
              </TabsContent>

              <TabsContent value="documents" className="mt-6">
                <DocumentsTab artworkId={artwork.id} />
              </TabsContent>
            </Tabs>
          </div>
        </ScrollableDialogBody>
        <ScrollableDialogFooter className="bg-background flex-shrink-0 z-10 border-t">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isFormActuallySaving}
              >
                Close
              </Button>
              {activeTab === "details" && autosaveStatus !== 'idle' && (
                <AutosaveIndicator status={autosaveStatus} />
              )}
            </div>
            {activeTab !== "details" && (
              <Button
                type="button"
                onClick={() => {
                  console.log("Update Artwork button clicked!");
                  handleUpdateArtwork();
                }}
                disabled={isFormActuallySaving}
              >
                {isFormActuallySaving ? "Updating..." : "Save Changes"}
              </Button>
            )}
          </div>
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </ScrollableDialog>
  );
}