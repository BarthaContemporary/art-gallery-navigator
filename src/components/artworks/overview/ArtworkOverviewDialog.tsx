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
} from "@/components/ui/scrollable-dialog";
import { ArtworkImageViewer } from "./ArtworkImageViewer";
import { ArtworkOverviewTabs } from "./ArtworkOverviewTabs";
import { ArtworkActions } from "../actions/ArtworkActions";
import { useScrollableDialog } from "@/hooks/use-scrollable-dialog";
import { Skeleton } from "@/components/ui/skeleton";

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

  const { scrollContainerRef } = useScrollableDialog(open, {
    enableKeyboardNavigation: true
  });

  return (
    <ScrollableDialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent
        size="4xl"
        className="max-h-[97vh] flex flex-col"
      >
        <ScrollableDialogHeader className="p-6 border-b pb-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <ScrollableDialogTitle className="text-2xl font-semibold">
                {artwork.title}
              </ScrollableDialogTitle>
              <p className="text-muted-foreground mt-1 text-base">
                {artistLoading ? (
                  <Skeleton className="w-32 h-5 rounded" />
                ) : artist?.full_name || "Unknown Artist"}
              </p>
            </div>
            <div className="mt-4 lg:mt-0">
              <ArtworkActions 
                artwork={artwork}
                artist={artist}
              />
            </div>
          </div>
        </ScrollableDialogHeader>

        <ScrollableDialogBody
          ref={scrollContainerRef}
          className="
            flex-1 min-h-0 px-4 md:px-10 py-6 
            bg-background
            space-y-8
            overflow-auto
            overscroll-y-contain
          "
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Image Viewer */}
            <div className="relative flex flex-col gap-4 w-full">
              <ArtworkImageViewer 
                artworkId={artwork.id}
                artistName={artist?.full_name || "Unknown_Artist"}
                artworkTitle={artwork.title}
              />
            </div>
            {/* Artwork Details */}
            <div className="space-y-6 w-full max-w-xl mx-auto">
              <ArtworkOverviewTabs
                artwork={artwork}
                artist={artist}
                artistLoading={artistLoading}
                location={location}
                locationLoading={locationLoading}
              />
            </div>
          </div>
        </ScrollableDialogBody>
      </ScrollableDialogContent>
    </ScrollableDialog>
  );
}
