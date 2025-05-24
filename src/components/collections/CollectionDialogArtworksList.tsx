
import { Artwork } from "@/hooks/use-artworks";

interface CollectionDialogArtworksListProps {
  artworks: Artwork[] | undefined;
  getArtistName: (artistId: string | null) => string;
}

export function CollectionDialogArtworksList({
  artworks,
  getArtistName,
}: CollectionDialogArtworksListProps) {
  if (!artworks || artworks.length === 0) {
    return (
      <p className="p-4 text-muted-foreground">No artworks in this collection</p>
    );
  }

  return (
    <div className="border rounded-lg divide-y">
      {artworks.map((artwork) => (
        <div key={artwork.id} className="p-4 flex items-center gap-4">
          <div className="flex-shrink-0 w-16 h-16 rounded overflow-hidden">
            <img
              src={artwork.image_url || "/placeholder.svg"}
              alt={artwork.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-grow">
            <h4 className="font-medium">{artwork.title}</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {getArtistName(artwork.artist_id)} • {artwork.year}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
