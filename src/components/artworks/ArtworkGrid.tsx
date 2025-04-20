
import { ArtworkCard } from "./ArtworkCard";

interface ArtworkGridProps {
  artworks: Array<{
    id: number;
    title: string;
    artist: string;
    year: number;
    medium: string;
    dimensions: string;
    price: number;
    status: string;
    image_url: string;
  }>;
}

export function ArtworkGrid({ artworks }: ArtworkGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {artworks.map((artwork) => (
        <ArtworkCard key={artwork.id} artwork={artwork} />
      ))}
    </div>
  );
}
