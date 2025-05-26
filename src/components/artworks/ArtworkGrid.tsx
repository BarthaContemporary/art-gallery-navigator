
import { ArtworkCard } from "./ArtworkCard";
import { Artwork } from "@/hooks/use-artworks";
import { useEffect, useRef } from "react";
import { useArtists } from "@/hooks/useArtists";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUp } from "lucide-react";

interface ArtworksByArtist {
  [key: string]: Artwork[];
}

interface ArtworkGridProps {
  artworks: Artwork[];
  activeIndex?: string;
  onScrollToTop?: () => void; // Added prop
}

export function ArtworkGrid({ artworks, activeIndex, onScrollToTop }: ArtworkGridProps) {
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const { data: artists } = useArtists();
  
  // Group artworks by artist's sort letter or first letter of full name
  const groupedArtworks = artworks.reduce((acc: ArtworksByArtist, artwork) => {
    let artistName = "Unknown Artist";
    let sortLetter: string | null = null;
    
    if (artwork.artist_id && artists) {
      const artist = artists.find(a => a.id === artwork.artist_id);
      if (artist) {
        artistName = artist.full_name;
        sortLetter = artist.surname_first_letter;
      }
    }
    
    const firstLetter = (sortLetter && sortLetter.trim() !== "") 
      ? sortLetter.trim().toUpperCase() 
      : artistName.charAt(0).toUpperCase();
    
    if (!acc[firstLetter]) {
      acc[firstLetter] = [];
    }
    acc[firstLetter].push(artwork);
    return acc;
  }, {});

  Object.keys(groupedArtworks).forEach(letter => {
    groupedArtworks[letter].sort((a, b) => {
      const artistDetailsA = artists?.find(artist => artist.id === a.artist_id);
      const artistDetailsB = artists?.find(artist => artist.id === b.artist_id);

      const artistNameA = artistDetailsA?.full_name || "Unknown Artist";
      const artistNameB = artistDetailsB?.full_name || "Unknown Artist";
      
      const artistCompare = artistNameA.localeCompare(artistNameB);
      if (artistCompare !== 0) return artistCompare;
      
      return a.title.localeCompare(b.title);
    });
  });

  // Scroll to section when activeIndex changes
  useEffect(() => {
    if (activeIndex && sectionRefs.current[activeIndex]) {
      sectionRefs.current[activeIndex]?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeIndex]);

  return (
    <div className="space-y-8">
      {Object.entries(groupedArtworks).sort().map(([letter, artworksInGroup]) => (
        <div 
          key={letter}
          ref={el => sectionRefs.current[letter] = el}
          className="scroll-mt-16" // Ensures the heading isn't hidden by a sticky nav when scrolled to
        >
          <div className="flex items-center mb-4">
            <h2 className="text-2xl font-bold">{letter}</h2>
            {onScrollToTop && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost" // Using ghost for a less prominent look
                      size="icon"
                      className="w-8 h-8 ml-2 p-0 flex items-center justify-center"
                      onClick={onScrollToTop}
                      aria-label="Scroll to top"
                    >
                      <ArrowUp className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Scroll to Top</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {artworksInGroup.map((artworkEntry) => ( 
              <ArtworkCard key={artworkEntry.id} artwork={artworkEntry} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
