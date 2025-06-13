
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
      <ScrollableDialogContent size="4xl">
        <ScrollableDialogHeader>
          <div className="flex justify-between items-start">
            <div>
              <ScrollableDialogTitle className="text-2xl font-semibold">
                {artwork.title}
              </ScrollableDialogTitle>
              <p className="text-muted-foreground mt-1">
                {artistLoading ? "Loading..." : artist?.full_name || "Unknown Artist"}
              </p>
            </div>
            <ArtworkActions 
              artwork={artwork}
              artist={artist}
            />
          </div>
        </ScrollableDialogHeader>

        <ScrollableDialogBody ref={scrollContainerRef}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Image Viewer */}
            <div className="space-y-4">
              <ArtworkImageViewer 
                artworkId={artwork.id}
                artistName={artist?.full_name || "Unknown_Artist"}
                artworkTitle={artwork.title}
              />
            </div>

            {/* Artwork Details */}
            <div className="space-y-6">
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
