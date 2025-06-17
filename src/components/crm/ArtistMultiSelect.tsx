
import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useArtists } from "@/hooks/useArtists";

interface ArtistMultiSelectProps {
  selectedArtists: string[];
  onArtistsChange: (artists: string[]) => void;
}

export function ArtistMultiSelect({ selectedArtists, onArtistsChange }: ArtistMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const { data: artists, isLoading } = useArtists();

  const handleSelectArtist = (artistId: string) => {
    if (selectedArtists.includes(artistId)) {
      onArtistsChange(selectedArtists.filter(id => id !== artistId));
    } else {
      onArtistsChange([...selectedArtists, artistId]);
    }
  };

  const handleRemoveArtist = (artistId: string) => {
    onArtistsChange(selectedArtists.filter(id => id !== artistId));
  };

  const getSelectedArtistNames = () => {
    if (!artists) return [];
    return selectedArtists.map(id => 
      artists.find(artist => artist.id === id)?.full_name || ''
    ).filter(Boolean);
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading artists...</div>;
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedArtists.length > 0 
              ? `${selectedArtists.length} artist${selectedArtists.length > 1 ? 's' : ''} selected`
              : "Select artists..."
            }
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Search artists..." />
            <CommandList>
              <CommandEmpty>No artists found.</CommandEmpty>
              <CommandGroup>
                {artists?.map((artist) => (
                  <CommandItem
                    key={artist.id}
                    onSelect={() => handleSelectArtist(artist.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedArtists.includes(artist.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {artist.full_name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {selectedArtists.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {getSelectedArtistNames().map((name, index) => {
            const artistId = selectedArtists[index];
            return (
              <Badge key={artistId} variant="secondary" className="text-xs">
                {name}
                <button
                  onClick={() => handleRemoveArtist(artistId)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
