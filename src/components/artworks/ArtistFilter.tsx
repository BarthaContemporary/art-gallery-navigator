
import { useMemo } from "react";
import { useArtists } from "@/hooks/useArtists"; 
import { Skeleton } from "@/components/ui/skeleton";
import { Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ArtistFilterProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function ArtistFilter({ value, onChange }: ArtistFilterProps) {
  const { data: artists, isLoading, error } = useArtists(); 

  const artistOptions = useMemo(() => {
    if (!artists || !Array.isArray(artists)) {
      return [{ value: "all", label: "All Artists" }];
    }
    
    const validArtists = artists
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

    return [{ value: "all", label: "All Artists" }, ...validArtists];
  }, [artists]);

  if (isLoading) {
    return <Skeleton className="h-8 md:h-10 w-full" />; 
  }

  if (error) {
    return <div className="text-red-500 text-xs md:text-sm p-2 border border-red-500 rounded-md h-8 md:h-10 flex items-center">Error loading artists.</div>;
  }

  return (
    <Select
      value={value || "all"}
      onValueChange={(newValue) => onChange(newValue === "all" ? null : newValue)}
    >
      <SelectTrigger className="w-full h-8 md:h-10 text-xs md:text-sm">
        <Filter className="mr-2 h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
        <SelectValue placeholder="Filter Artist" />
      </SelectTrigger>
      <SelectContent>
        {artistOptions.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-xs md:text-sm">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
