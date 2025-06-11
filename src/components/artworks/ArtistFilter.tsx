
import { useArtists } from "@/hooks/useArtists";
import { Filter, Users } from "lucide-react";
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
        <SelectTrigger className="w-full h-6 text-xs px-1 gap-0.5">
          <Filter className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <SelectValue placeholder="Loading..." />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value || "all"} onValueChange={handleValueChange}>
      <SelectTrigger className="w-full h-6 text-xs px-1 gap-0.5">
        <Filter className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        <SelectValue placeholder="All Artists" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all" className="text-xs">
          <div className="flex items-center">
            <Users className="mr-2 h-3 w-3" />
            All Artists
          </div>
        </SelectItem>
        {artists?.map((artist) => (
          <SelectItem key={artist.id} value={artist.id} className="text-xs">
            {artist.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
