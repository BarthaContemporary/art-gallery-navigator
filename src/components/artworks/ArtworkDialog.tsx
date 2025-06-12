
import React from "react";
import { Artwork } from "@/hooks/use-artworks";
import { useArtist } from "@/hooks/use-artist";
import { useLocation } from "@/hooks/use-location";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArtworkImageCarousel } from "./carousel/ArtworkImageCarousel";
import { ArtworkDetails } from "./details/ArtworkDetails";
import { ArtworkActions } from "./actions/ArtworkActions";

interface ArtworkDialogProps {
  artwork: Artwork;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArtworkDialog({
  artwork,
  open,
  onOpenChange,
}: ArtworkDialogProps) {
  const { data: artist, isLoading: artistLoading } = useArtist(artwork.artist_id);
  const { data: location, isLoading: locationLoading } = useLocation(artwork.location_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-2xl font-semibold">
                {artwork.title}
              </DialogTitle>
              <p className="text-muted-foreground mt-1">
                {artistLoading ? "Loading..." : artist?.full_name || "Unknown Artist"}
              </p>
            </div>
            <ArtworkActions 
              artwork={artwork}
              artist={artist}
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
            {/* Image Carousel */}
            <div className="space-y-4">
              <ArtworkImageCarousel 
                artworkId={artwork.id}
                artistName={artist?.full_name || "Unknown_Artist"}
                artworkTitle={artwork.title}
              />
            </div>

            {/* Artwork Details */}
            <div className="space-y-6">
              <ArtworkDetails
                artwork={artwork}
                artist={artist}
                artistLoading={artistLoading}
                location={location}
                locationLoading={locationLoading}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
