
import { ArtworkCard } from "./ArtworkCard";
import { Artwork } from "@/hooks/use-artworks";
import { useEffect, useRef } from "react";

interface ArtworksByArtist {
  [key: string]: Artwork[];
}

interface ArtworkGridProps {
  artworks: Artwork[];
  activeIndex?: string;
}

export function ArtworkGrid({ artworks, activeIndex }: ArtworkGridProps) {
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Group artworks by artist's first letter
  const groupedArtworks = artworks.reduce((acc: ArtworksByArtist, artwork) => {
    // Get artist name from the artwork, fallback to "Unknown Artist"
    const artistName = artwork.artist_id ? "Unknown Artist" : "Unknown Artist";
    const firstLetter = artistName.charAt(0).toUpperCase();
    
    if (!acc[firstLetter]) {
      acc[firstLetter] = [];
    }
    acc[firstLetter].push(artwork);
    return acc;
  }, {});

  // Sort artworks within each group
  Object.keys(groupedArtworks).forEach(letter => {
    groupedArtworks[letter].sort((a, b) => {
      const titleA = a.title.toLowerCase();
      const titleB = b.title.toLowerCase();
      return titleA.localeCompare(titleB);
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {artworksInGroup.map((artwork) => (
              <ArtworkCard key={artwork.id} artwork={artwork} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
