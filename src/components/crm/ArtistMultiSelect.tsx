
import { useState } from "react";
import { Check, ChevronsUpDown, X, UserPlus } from "lucide-react";
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

  const handleAddAllRepresented = () => {
    if (!artists) return;
    
    const representedArtists = artists
      .filter(artist => artist.representation_status?.toLowerCase() === 'represented')
      .map(artist => artist.id);
    
    // Merge with existing selections, avoiding duplicates
    const newSelection = [...new Set([...selectedArtists, ...representedArtists])];
    onArtistsChange(newSelection);
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

  const representedArtistsCount = artists?.filter(
    artist => artist.representation_status?.toLowerCase() === 'represented'
  ).length || 0;

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
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search artists..." />
            <div className="p-2 border-b">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddAllRepresented}
                className="w-full"
                disabled={representedArtistsCount === 0}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add All Represented ({representedArtistsCount})
              </Button>
            </div>
            <CommandList className="max-h-[200px] overflow-y-auto">
              <CommandEmpty>No artists found.</CommandEmpty>
              <CommandGroup>
                {artists?.map((artist) => (
                  <CommandItem
                    key={artist.id}
                    onSelect={() => handleSelectArtist(artist.id)}
                    className="flex items-center gap-2"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        selectedArtists.includes(artist.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1">
                      <span>{artist.full_name}</span>
                      {artist.representation_status && (
                        <Badge 
                          variant="outline" 
                          className="ml-2 text-xs"
                        >
                          {artist.representation_status}
                        </Badge>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {selectedArtists.length > 0 && (
        <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-2 border rounded-md bg-muted/30">
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
