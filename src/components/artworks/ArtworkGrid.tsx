import React, { memo, useMemo } from "react";
import { ArtworkCard } from "./ArtworkCard";
import { Artwork } from "@/hooks/use-artworks";
import { useEffect, useRef } from "react";
import { useArtists } from "@/hooks/useArtists";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUp } from "lucide-react";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { AlertTriangle } from "lucide-react";

interface ArtworksByArtist {
  [key: string]: Artwork[];
}

interface ArtworkGridProps {
  artworks: Artwork[];
  activeIndex?: string;
  onScrollToTop?: () => void;
}

// Simple fallback component for an individual artwork card
const ArtworkCardErrorFallback = ({ artworkId }: { artworkId: string }) => (
  <div 
    className="group relative flex flex-col h-full border border-destructive bg-destructive/10 rounded-lg p-4 items-center justify-center text-center"
    style={{ minHeight: '320px' }} // Reduced from 384px
    role="alert"
    aria-live="polite"
  >
    <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
    <p className="text-sm font-semibold text-destructive-foreground">Artwork Error</p>
    <p className="text-xs text-destructive-foreground/80">Could not load this artwork (ID: {artworkId ? artworkId.substring(0,8) : 'N/A'}).</p>
  </div>
);

// Reduced card height: image 192px (reduced from 256px) + info 170px + padding 32px
const FIXED_CARD_HEIGHT = 394;

function ArtworkGridComponent({ artworks, activeIndex, onScrollToTop }: ArtworkGridProps) {
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const { data: artists } = useArtists();
  
  // Memoize the grouped artworks to prevent unnecessary recalculations
  const groupedArtworks = useMemo(() => {
    return artworks.reduce((acc: ArtworksByArtist, artwork) => {
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
  }, [artworks, artists]);

  // Memoize the sorted groups to prevent unnecessary re-sorting
  const sortedGroups = useMemo(() => {
    const groups = { ...groupedArtworks };
    
    // Sort artworks within each group by artist name, then by price descending
    Object.keys(groups).forEach(letter => {
      groups[letter].sort((a, b) => {
        const artistDetailsA = artists?.find(artist => artist.id === a.artist_id);
        const artistDetailsB = artists?.find(artist => artist.id === b.artist_id);

        const artistNameA = artistDetailsA?.full_name || "Unknown Artist";
        const artistNameB = artistDetailsB?.full_name || "Unknown Artist";
        
        // First sort by artist name
        const artistCompare = artistNameA.localeCompare(artistNameB);
        if (artistCompare !== 0) return artistCompare;
        
        // Then sort by price descending (higher prices first)
        const priceA = a.price || 0;
        const priceB = b.price || 0;
        return priceB - priceA;
      });
    });
    
    return groups;
  }, [groupedArtworks, artists]);

  // Scroll to section when activeIndex changes
  useEffect(() => {
    if (activeIndex && sectionRefs.current[activeIndex]) {
      sectionRefs.current[activeIndex]?.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, [activeIndex]);

  const handleScrollToTop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onScrollToTop?.();
  };

  return (
    <div 
      className="space-y-8"
      style={{ 
        contain: 'layout',
        willChange: 'scroll-position'
      }}
    >
      {Object.entries(sortedGroups).sort().map(([letter, artworksInGroup]) => (
        <div 
          key={letter}
          ref={el => sectionRefs.current[letter] = el}
          className="scroll-mt-16"
          style={{ contain: 'layout' }}
        >
          <div className="flex items-center mb-4">
            <h2 className="text-2xl font-bold">{letter}</h2>
            {onScrollToTop && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 ml-2 p-0 flex items-center justify-center"
                      onClick={handleScrollToTop}
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
          
          {/* Reduced grid gaps for tighter spacing with minimal vertical space */}
          <div 
            className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1"
            style={{ 
              contain: 'layout',
              gridTemplateRows: 'masonry' // If supported, otherwise falls back to normal grid
            }}
          >
            {artworksInGroup.map((artworkEntry) => ( 
              <div 
                key={artworkEntry.id}
                className="w-full"
                style={{ 
                  contain: 'layout size',
                  minHeight: `${FIXED_CARD_HEIGHT}px`,
                }}
              >
                <ErrorBoundary 
                  fallback={<ArtworkCardErrorFallback artworkId={artworkEntry.id} />}
                >
                  <ArtworkCard artwork={artworkEntry} />
                </ErrorBoundary>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const ArtworkGrid = memo(ArtworkGridComponent);
