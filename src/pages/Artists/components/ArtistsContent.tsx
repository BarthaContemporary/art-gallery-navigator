
import { LoadingSkeleton } from "@/components/artists/LoadingSkeleton";
import { ArtistCard } from "@/components/artists/ArtistCard";
import { ArtistListView } from "@/components/artists/ArtistListView";
import { ViewMode } from "@/components/ui/view-toggle";

interface Artist {
  id: string;
  full_name: string;
  surname_first_letter?: string | null;
  birth_year: number | null;
  death_year?: number | null;
  place_of_birth?: string | null;
  place_of_death?: string | null;
  nationality: string | null;
  representation_status: string;
  biography: string | null;
  image_url: string | null;
  email?: string | null;
}

interface ArtistsContentProps {
  isLoading: boolean;
  filteredArtists: Artist[];
  searchTerm: string;
  statusFilter: string;
  viewMode: ViewMode;
}

export const ArtistsContent = ({
  isLoading,
  filteredArtists,
  searchTerm,
  statusFilter,
  viewMode
}: ArtistsContentProps) => {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (filteredArtists.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {searchTerm || statusFilter !== "all" ? "No artists found matching your criteria" : "No artists found"}
        </p>
      </div>
    );
  }

  if (viewMode === 'list') {
    return <ArtistListView artists={filteredArtists} />;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
      {filteredArtists.map(artist => (
        <ArtistCard key={artist.id} artist={artist} />
      ))}
    </div>
  );
};
