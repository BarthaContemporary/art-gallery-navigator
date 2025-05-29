
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

  const handleSelectionChange = (selectedValue: string) => {
    if (selectedValue === "_none") {
      onChange(null);
    } else {
      onChange(selectedValue);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-8 md:h-10 w-full" />; 
  }

  if (error) {
    return <div className="text-red-500 text-xs md:text-sm p-2 border border-red-500 rounded-md h-8 md:h-10 flex items-center">Error loading artists.</div>;
  }

  return (
    <div className="w-full">
      <SearchableSelect
        options={artistOptions}
        value={value || "_none"} 
        onChange={handleSelectionChange}
        placeholder="Filter Artist"
        icon={<Filter className="mr-1.5 md:mr-2 h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />}
        triggerClassName="w-full h-8 md:h-10 text-xs md:text-sm whitespace-nowrap overflow-hidden text-ellipsis"
      />
    </div>
  );
}
