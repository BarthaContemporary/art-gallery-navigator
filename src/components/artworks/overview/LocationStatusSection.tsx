
import { Artwork } from "@/hooks/use-artworks";
import { Location } from "@/hooks/use-locations";

interface LocationStatusSectionProps {
  artwork: Artwork;
  location: Location | null | undefined;
  locationLoading: boolean;
}

export function LocationStatusSection({ artwork, location, locationLoading }: LocationStatusSectionProps) {
  return (
    <div>
      <h3 className="text-lg font-medium mb-4">Location & Status</h3>
      <dl className="space-y-2">
        <div className="flex flex-col">
          <dt className="text-sm font-medium text-muted-foreground">Location</dt>
          <dd>{locationLoading ? "Loading..." : location?.name || 'N/A'}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-sm font-medium text-muted-foreground">Status</dt>
          <dd className="capitalize">{artwork.status || 'N/A'}</dd>
        </div>
      </dl>
    </div>
  );
}
