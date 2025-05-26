import { ArtworkCard } from "./ArtworkCard";
import { Artwork } from "@/hooks/use-artworks";
import { useEffect, useRef } from "react";
import { useArtists } from "@/hooks/useArtists";

interface ArtworksByArtist {
  [key: string]: Artwork[];
}

interface ArtworkGridProps {
  artworks: Artwork[];
  activeIndex?: string;
}

export function ArtworkGrid({ artworks, activeIndex }: ArtworkGridProps) {
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
    
    // Use surname_first_letter if available and not empty, otherwise use first letter of full_name
    const firstLetter = (sortLetter && sortLetter.trim() !== "") 
      ? sortLetter.trim().toUpperCase() 
      : artistName.charAt(0).toUpperCase();
    
    if (!acc[firstLetter]) {
      acc[firstLetter] = [];
    }
    acc[firstLetter].push(artwork);
    return acc;
  }, {});

  // Sort artworks within each group by artist name first, then by title
  Object.keys(groupedArtworks).forEach(letter => {
    groupedArtworks[letter].sort((a, b) => {
      const artistDetailsA = artists?.find(artist => artist.id === a.artist_id);
      const artistDetailsB = artists?.find(artist => artist.id === b.artist_id);

      const artistNameA = artistDetailsA?.full_name || "Unknown Artist";
      const artistNameB = artistDetailsB?.full_name || "Unknown Artist";
      
      // First sort by artist full name
      const artistCompare = artistNameA.localeCompare(artistNameB);
      if (artistCompare !== 0) return artistCompare;
      
      // If same artist, sort by title
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
          className="scroll-mt-16"
        >
          <h2 className="text-2xl font-bold mb-4">{letter}</h2>
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
