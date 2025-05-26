
import { useState } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { useArtists } from "@/hooks/useArtists"; 
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ArtworkSearchProps {
  artworks: Artwork[];
  selectedArtworks: string[];
  onToggleArtwork: (id: string) => void;
}

export function ArtworkSearch({ artworks = [], selectedArtworks = [], onToggleArtwork }: ArtworkSearchProps) {
  const [search, setSearch] = useState("");
  const { data: artists } = useArtists();

  const getArtistName = (artistId: string | null) => {
    if (!artistId || !artists) return "Unknown Artist";
    const artist = artists.find((a) => a.id === artistId);
    return artist ? artist.full_name : "Unknown Artist";
  };
  
  const filteredArtworks = artworks.filter((artwork) => {
    const searchLower = search.toLowerCase();
    const artistName = getArtistName(artwork.artist_id).toLowerCase();
    return (
      artwork.title.toLowerCase().includes(searchLower) ||
      artistName.includes(searchLower)
    );
  });

  return (
    <Command className="rounded-lg border shadow-md">
      <CommandInput
        placeholder="Search artworks..."
        value={search}
        onValueChange={setSearch}
        className="h-8 text-xs md:h-10 md:text-sm"
      />
      <CommandList>
        <ScrollArea className="h-[200px]">
          {filteredArtworks.length > 0 ? (
            <CommandGroup>
              {filteredArtworks.map((artwork) => (
                <CommandItem
                  key={artwork.id}
                  value={artwork.title}
                  onSelect={() => onToggleArtwork(artwork.id)}
                  className="flex items-center gap-2 cursor-pointer text-xs md:text-sm"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <div
                      className={`flex h-3 w-3 md:h-4 md:w-4 items-center justify-center rounded-sm border ${
                        selectedArtworks.includes(artwork.id)
                          ? "bg-primary border-primary"
                          : "border-input"
                      }`}
                    >
                      {selectedArtworks.includes(artwork.id) && (
                        <Check className="h-2 w-2 md:h-3 md:w-3 text-primary-foreground" />
                      )}
                    </div>
                    <span className="flex-1">
                      {artwork.title}
                      <span className="text-xs text-muted-foreground ml-2">
                        by {getArtistName(artwork.artist_id)}
                      </span>
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : (
            <CommandEmpty>No artworks found.</CommandEmpty>
          )}
        </ScrollArea>
      </CommandList>
    </Command>
  );
}
