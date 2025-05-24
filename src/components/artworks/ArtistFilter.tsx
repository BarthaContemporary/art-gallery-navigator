
import { useMemo } from "react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useArtists } from "@/components/artworks/form/useArtists"; // Using the same hook as Artworks page
import { Skeleton } from "@/components/ui/skeleton";
import { Filter, Users } from "lucide-react"; // Import Filter icon for consistency

interface ArtistFilterProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function ArtistFilter({ value, onChange }: ArtistFilterProps) {
  const { data: artists, isLoading } = useArtists();

  const artistOptions = useMemo(() => {
    if (!artists || !Array.isArray(artists)) return [];
    return artists.map((artist) => ({
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
    return <Skeleton className="h-10 w-full min-w-[180px]" />;
  }

  return (
    <div className="min-w-[180px]">
      <SearchableSelect
        options={artistOptions}
        value={value || "_none"} // Pass "_none" if value is null
        onChange={handleSelectionChange}
        placeholder="Filter by artist"
        icon={<Filter className="mr-2 h-4 w-4" />} // Add filter icon for consistency
      />
    </div>
  );
}
