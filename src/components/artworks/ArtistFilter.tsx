
import { useMemo } from "react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useArtists } from "@/hooks/useArtists"; 
import { Skeleton } from "@/components/ui/skeleton";
import { Filter } from "lucide-react";

interface ArtistFilterProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function ArtistFilter({ value, onChange }: ArtistFilterProps) {
  const { data: artists, isLoading, error } = useArtists(); 

  // console.log("ArtistFilter artists:", artists, "isLoading:", isLoading, "error:", error);

  const artistOptions = useMemo(() => {
    if (!artists || !Array.isArray(artists)) {
      return [];
    }
    
    return artists
      .filter(artist => 
        artist && 
        typeof artist === 'object' &&
        artist.id && 
        typeof artist.id === 'string' && 
        artist.id.trim() !== '' &&
        artist.full_name &&
        typeof artist.full_name === 'string' &&
        artist.full_name.trim() !== ''
      )
      .map((artist) => ({
        value: artist.id,
        label: artist.full_name,
      }));
  }, [artists]);

  // console.log("ArtistFilter artistOptions:", artistOptions);

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

  if (error) {
    // console.error("ArtistFilter error state:", error);
    return <div className="min-w-[180px] text-red-500 text-sm p-2 border border-red-500 rounded-md">Error loading artists.</div>;
  }

  return (
    <div className="min-w-[180px]">
      <SearchableSelect
        options={artistOptions}
        value={value || "_none"} // Ensure value is always a string for SearchableSelect
        onChange={handleSelectionChange}
        placeholder="Filter by artist"
        icon={<Filter className="mr-2 h-4 w-4" />}
      />
    </div>
  );
}

