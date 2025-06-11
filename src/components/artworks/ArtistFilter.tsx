
import { useArtists } from "@/hooks/useArtists";
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
  const { data: artists, isLoading } = useArtists();

  const handleValueChange = (newValue: string) => {
    onChange(newValue === "all" ? null : newValue);
  };

  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger className="w-full h-8 md:h-10 text-xs md:text-sm gap-0.5 px-2">
          <Filter className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
          <SelectValue placeholder="Loading..." />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value || "all"} onValueChange={handleValueChange}>
      <SelectTrigger className="w-full h-8 md:h-10 text-xs md:text-sm gap-0.5 px-2">
        <Filter className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
        <SelectValue placeholder="All Artists" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Artists</SelectItem>
        {artists?.map((artist) => (
          <SelectItem key={artist.id} value={artist.id}>
            {artist.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
