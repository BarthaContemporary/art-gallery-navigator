
import { Badge } from "@/components/ui/badge";
import { useArtists } from "@/hooks/useArtists";

interface ClientTagsSectionProps {
  client: any;
}

export function ClientTagsSection({ client }: ClientTagsSectionProps) {
  const { data: artists } = useArtists();
  
  const hasArtists = client.interested_artists && client.interested_artists.length > 0;
  const hasTags = client.tags && client.tags.length > 0;
  
  if (!hasArtists && !hasTags) return null;

  // Get artist names from IDs
  const getArtistNames = () => {
    if (!artists || !client.interested_artists) return [];
    return client.interested_artists
      .map((artistId: string) => artists.find(artist => artist.id === artistId)?.full_name)
      .filter(Boolean);
  };

  const artistNames = getArtistNames();

  return (
    <div className="pt-4 border-t space-y-4">
      {hasArtists && artistNames.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-2">
            Interested Artists
          </h3>
          <div className="flex flex-wrap gap-1">
            {artistNames.map((artistName: string, index: number) => (
              <Badge key={index} variant="outline" className="text-xs px-2 py-1">
                {artistName}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {hasTags && (
        <div>
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-2">
            Tags
          </h3>
          <div className="flex flex-wrap gap-1">
            {client.tags.map((tag: string, index: number) => (
              <Badge key={index} variant="outline" className="text-xs px-2 py-1">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
