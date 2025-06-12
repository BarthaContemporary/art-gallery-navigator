
import { SimpleArtworkCarousel } from "./carousel/SimpleArtworkCarousel";

interface ArtworkCarouselProps {
  artworkId: string;
  artistName?: string;
  artworkTitle?: string;
  isDialogActive?: boolean;
}

export function ArtworkCarousel({
  artworkId,
  artistName = "Unknown_Artist",
  artworkTitle = "Untitled",
  isDialogActive = false
}: ArtworkCarouselProps) {
  return (
    <SimpleArtworkCarousel
      artworkId={artworkId}
      artistName={artistName}
      artworkTitle={artworkTitle}
      isDialogActive={isDialogActive}
    />
  );
}
