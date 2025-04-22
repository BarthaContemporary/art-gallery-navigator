
import { Artwork } from "@/hooks/use-artworks";
import { Artist } from "@/hooks/use-artist";

interface ArtworkDetailsSectionProps {
  artwork: Artwork;
  artist: Artist | null | undefined;
  artistLoading: boolean;
}

export function ArtworkDetailsSection({ artwork, artist, artistLoading }: ArtworkDetailsSectionProps) {
  return (
    <div>
      <h3 className="text-lg font-medium mb-4">Artwork Information</h3>
      <dl className="space-y-2">
        <div className="flex flex-col">
          <dt className="text-sm font-medium text-muted-foreground">Artist</dt>
          <dd>{artistLoading ? "Loading..." : artist?.full_name || "No artist specified"}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-sm font-medium text-muted-foreground">Year</dt>
          <dd>{artwork.year}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-sm font-medium text-muted-foreground">Medium Type</dt>
          <dd>{artwork.medium_type}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-sm font-medium text-muted-foreground">Materials</dt>
          <dd>{artwork.materials}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-sm font-medium text-muted-foreground">Classification</dt>
          <dd>{artwork.classification}</dd>
        </div>
        {artwork.classification !== 'Unique' && (
          <>
            <div className="flex flex-col">
              <dt className="text-sm font-medium text-muted-foreground">Edition Size</dt>
              <dd>{artwork.edition_size || 'N/A'}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-sm font-medium text-muted-foreground">Available Works</dt>
              <dd>{artwork.available_works || 0}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-sm font-medium text-muted-foreground">Inventory Quantity</dt>
              <dd>{artwork.inventory_quantity || 0}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-sm font-medium text-muted-foreground">Artist Proofs</dt>
              <dd>{artwork.artist_proofs || 0}</dd>
            </div>
          </>
        )}
      </dl>
    </div>
  );
}
