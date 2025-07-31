
import React from "react";
import { Artwork } from "@/hooks/use-artworks";
import { useArtist } from "@/hooks/use-artist";
import { useLocation } from "@/hooks/use-location";
import {
  ScrollableDialog,
  ScrollableDialogContent,
  ScrollableDialogHeader,
  ScrollableDialogTitle,
  ScrollableDialogBody,
  ScrollableDialogPortal,
} from "@/components/ui/scrollable-dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArtworkImageViewer } from "./ArtworkImageViewer";
import { ArtworkOverviewTabs } from "./ArtworkOverviewTabs";
import { DialogHeaderActions } from "./DialogHeaderActions";
import { useScrollableDialog } from "@/hooks/use-scrollable-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Edit, X } from "lucide-react";
import { ArtworkEditDialogHandler } from "../dialogs/ArtworkEditDialogHandler";
import { useState } from "react";

interface ArtworkOverviewDialogProps {
  artwork: Artwork;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArtworkOverviewDialog({
  artwork,
  open,
  onOpenChange,
}: ArtworkOverviewDialogProps) {
  const { data: artist, isLoading: artistLoading } = useArtist(artwork.artist_id);
  const { data: location, isLoading: locationLoading } = useLocation(artwork.location_id);
  const { scrollContainerRef } = useScrollableDialog(open, { enableKeyboardNavigation: true });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const titleWithYear = artwork.year ? `${artwork.title}, ${artwork.year}` : artwork.title;

  const handleEditClick = () => {
    setIsEditDialogOpen(true);
  };

  return (
    <>
      <ScrollableDialog open={open} onOpenChange={onOpenChange}>
        <ScrollableDialogPortal>
          {/* Custom overlay with white background and blur */}
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-white/80 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className="fixed left-[50%] top-[50%] z-50 w-full max-w-4xl h-[90vh] translate-x-[-50%] translate-y-[-50%] border-none bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] flex flex-col group p-0"
          >
            {/* Close button */}
            <DialogPrimitive.Close className="absolute right-4 top-4 z-[60] opacity-20 group-hover:opacity-100 transition-opacity duration-200 rounded-sm bg-yellow-400/30 backdrop-blur-sm hover:bg-yellow-400/90 text-white hover:text-black p-2 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 disabled:pointer-events-none flex items-center justify-center">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
            <div className="relative w-full bg-gray-50 flex-shrink-0">
              <ArtworkImageViewer 
                artworkId={artwork.id}
                artworkTitle={artwork.title}
              />
            </div>
            <ScrollableDialogHeader className="px-6 py-2 bg-white flex-shrink-0" />
            <ScrollableDialogBody
              ref={scrollContainerRef}
              className="bg-white"
            >
              <div className="px-6 py-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1 min-w-0">
                    <ScrollableDialogTitle className="text-2xl font-semibold text-foreground">
                      {titleWithYear}
                    </ScrollableDialogTitle>
                    <p className="text-muted-foreground mt-1 text-base">
                      {artistLoading ? (
                        <Skeleton className="w-32 h-5 rounded" />
                      ) : artist?.full_name || "Unknown Artist"}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleEditClick}
                      title="Edit Artwork"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <DialogHeaderActions artwork={artwork} />
                  </div>
                </div>
                <div className="mt-6">
                  <ArtworkOverviewTabs
                    artwork={artwork}
                    artist={artist}
                    artistLoading={artistLoading}
                    location={location}
                    locationLoading={locationLoading}
                  />
                </div>
                {/* Add extra content to force scrolling for testing */}
                <div className="mt-8 space-y-4">
                  <div className="h-32 bg-gray-100 rounded p-4">Extra content block 1</div>
                  <div className="h-32 bg-gray-100 rounded p-4">Extra content block 2</div>
                  <div className="h-32 bg-gray-100 rounded p-4">Extra content block 3</div>
                  <div className="h-32 bg-gray-100 rounded p-4">Extra content block 4</div>
                  <div className="h-32 bg-gray-100 rounded p-4">Extra content block 5</div>
                </div>
              </div>
            </ScrollableDialogBody>
          </DialogPrimitive.Content>
        </ScrollableDialogPortal>
      </ScrollableDialog>

      <ArtworkEditDialogHandler
        artwork={artwork}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </>
  );
}
