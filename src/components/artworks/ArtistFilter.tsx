
import { useMemo } from "react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useArtists } from "@/components/artworks/form/useArtists";
import { Skeleton } from "@/components/ui/skeleton";
import { Filter } from "lucide-react";

interface ArtistFilterProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function ArtistFilter({ value, onChange }: ArtistFilterProps) {
  const { data: artists, isLoading } = useArtists();

  const artistOptions = useMemo(() => {
    // Ensure we have artists data and it's an array
    if (!artists || !Array.isArray(artists)) {
      return [];
    }
    
    // Filter out any invalid artist entries
    return artists
      .filter(artist => 
        artist && 
        typeof artist.id === 'string' && 
        artist.id.trim() !== '' &&
        typeof artist.full_name === 'string' &&
        artist.full_name.trim() !== ''
      )
      .map((artist) => ({
        value: artist.id,
        label: artist.full_name,
      }));
  }, [artists]);

  // Handle selection change
  const handleSelectionChange = (selectedValue: string) => {
    if (selectedValue === "_none") {
      onChange(null);
    } else {
      onChange(selectedValue);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-10 w-full min-w-[180px]" />;
  }

  return (
    <div className="min-w-[180px]">
      <SearchableSelect
        options={artistOptions}
        value={value || "_none"}
        onChange={handleSelectionChange}
        placeholder="Filter by artist"
        icon={<Filter className="mr-2 h-4 w-4" />}
      />
    </div>
  );
}
