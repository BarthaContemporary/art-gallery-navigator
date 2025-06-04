
import { useArtists } from "@/hooks/useArtists";
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
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Loading..." />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value || "all"} onValueChange={handleValueChange}>
      <SelectTrigger className="w-full">
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
