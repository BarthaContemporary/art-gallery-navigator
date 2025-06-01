
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { ArtworkCard } from "./ArtworkCard";
import { Artwork } from "@/hooks/use-artworks";
import { useArtists } from "@/hooks/useArtists";
import { useIsMobile } from "@/hooks/use-mobile";

interface VirtualizedArtworkGridProps {
  artworks: Artwork[];
  containerHeight: number;
  onScrollToTop?: () => void;
}

export function VirtualizedArtworkGrid({ 
  artworks, 
  containerHeight,
  onScrollToTop 
}: VirtualizedArtworkGridProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const isMobile = useIsMobile();
  const { data: artists } = useArtists();
  const scrollElementRef = useRef<HTMLDivElement>(null);

  // Calculate grid dimensions
  const { columnCount, itemWidth, itemHeight, rowCount } = useMemo(() => {
    if (containerWidth === 0) return { columnCount: 1, itemWidth: 300, itemHeight: 400, rowCount: 0 };
    
    const minItemWidth = isMobile ? 280 : 320;
    const cols = Math.max(1, Math.floor(containerWidth / minItemWidth));
    const width = Math.floor(containerWidth / cols);
    const height = Math.floor(width * 1.4); // Maintain aspect ratio
    const rows = Math.ceil(artworks.length / cols);
    
    return {
      columnCount: cols,
      itemWidth: width,
      itemHeight: height,
      rowCount: rows
    };
  }, [containerWidth, artworks.length, isMobile]);

  // Group artworks by artist's sort letter (maintain existing grouping logic)
  const groupedArtworks = useMemo(() => {
    // Filter out any null or undefined artworks first
    const validArtworks = artworks.filter(artwork => artwork && artwork.id);
    
    const grouped = validArtworks.reduce((acc: { [key: string]: Artwork[] }, artwork) => {
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

    // Sort within each group
    Object.keys(grouped).forEach(letter => {
      grouped[letter].sort((a, b) => {
        const artistDetailsA = artists?.find(artist => artist.id === a.artist_id);
        const artistDetailsB = artists?.find(artist => artist.id === b.artist_id);

        const artistNameA = artistDetailsA?.full_name || "Unknown Artist";
        const artistNameB = artistDetailsB?.full_name || "Unknown Artist";
        
        const artistCompare = artistNameA.localeCompare(artistNameB);
        if (artistCompare !== 0) return artistCompare;
        
        return a.title.localeCompare(b.title);
      });
    });

    return grouped;
  }, [artworks, artists]);

  // Flatten grouped artworks for virtualization
  const flattenedArtworks = useMemo(() => {
    return Object.entries(groupedArtworks)
      .sort()
      .flatMap(([letter, works]) => works);
  }, [groupedArtworks]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startRow = Math.floor(scrollTop / itemHeight);
    const endRow = Math.min(
      rowCount - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight)
    );
    
    const startIndex = startRow * columnCount;
    const endIndex = Math.min(
      flattenedArtworks.length - 1,
      (endRow + 1) * columnCount - 1
    );
    
    return { startIndex, endIndex, startRow, endRow };
  }, [scrollTop, itemHeight, containerHeight, rowCount, columnCount, flattenedArtworks.length]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Measure container width
  useEffect(() => {
    const measureWidth = () => {
      const container = document.getElementById('virtualized-grid-container');
      if (container) {
        setContainerWidth(container.clientWidth);
      }
    };

    measureWidth();
    window.addEventListener('resize', measureWidth);
    return () => window.removeEventListener('resize', measureWidth);
  }, []);

  if (containerWidth === 0) {
    return (
      <div id="virtualized-grid-container" className="w-full">
        <div className="text-center py-8">Measuring container...</div>
      </div>
    );
  }

  const totalHeight = rowCount * itemHeight;
  const { startIndex, endIndex, startRow } = visibleRange;

  return (
    <div id="virtualized-grid-container" className="w-full">
      <div
        ref={scrollElementRef}
        className="overflow-auto"
        style={{ height: containerHeight }}
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {Array.from({ length: endIndex - startIndex + 1 }, (_, i) => {
            const index = startIndex + i;
            if (index >= flattenedArtworks.length) return null;
            
            const artwork = flattenedArtworks[index];
            // Add safety check for artwork
            if (!artwork || !artwork.id) return null;
            
            const row = Math.floor(index / columnCount);
            const col = index % columnCount;
            
            return (
              <div
                key={artwork.id}
                className="absolute p-3"
                style={{
                  left: col * itemWidth,
                  top: row * itemHeight,
                  width: itemWidth,
                  height: itemHeight,
                }}
              >
                <div style={{ width: itemWidth - 24, height: itemHeight - 24 }}>
                  <ArtworkCard artwork={artwork} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
