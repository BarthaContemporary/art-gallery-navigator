
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
  const { scrollContainerRef } = useScrollableDialog(open, { enableKeyboardNavigation: true });

  return (
    <ScrollableDialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent
        size="4xl"
        className="flex flex-col h-[95vh] max-h-[95vh] min-h-0 p-0"
      >
        <div className="relative w-full bg-black/95 flex-shrink-0">
          <ArtworkImageViewer 
            artworkId={artwork.id}
            artistName={artist?.full_name || "Unknown_Artist"}
            artworkTitle={artwork.title}
          />
        </div>
        <ScrollableDialogHeader className="px-6 py-4 border-b bg-background flex-shrink-0" />
        <ScrollableDialogBody
          ref={scrollContainerRef}
          className="flex-1 min-h-0 bg-background"
          showScrollIndicator={true}
        >
          <div className="max-w-4xl mx-auto px-6 py-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1 min-w-0">
                <ScrollableDialogTitle className="text-2xl font-semibold text-foreground">
                  {artwork.title}
                </ScrollableDialogTitle>
                <p className="text-muted-foreground mt-1 text-base">
                  {artistLoading ? (
                    <Skeleton className="w-32 h-5 rounded" />
                  ) : artist?.full_name || "Unknown Artist"}
                </p>
              </div>
              <div className="flex-shrink-0">
                <ArtworkActions 
                  artwork={artwork}
                  artist={artist}
                />
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
          </div>
        </ScrollableDialogBody>
      </ScrollableDialogContent>
    </ScrollableDialog>
  );
}
