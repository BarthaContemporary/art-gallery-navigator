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

  // Comprehensive artwork validation and filtering
  const validArtworks = useMemo(() => {
    if (!Array.isArray(artworks)) {
      console.warn('Artworks is not an array:', artworks);
      return [];
    }
    
    return artworks.filter(artwork => {
      if (!artwork) {
        console.warn('Found null/undefined artwork');
        return false;
      }
      
      if (typeof artwork !== 'object') {
        console.warn('Artwork is not an object:', artwork);
        return false;
      }
      
      if (!artwork.id) {
        console.warn('Artwork missing id:', artwork);
        return false;
      }
      
      if (!artwork.title) {
        console.warn('Artwork missing title:', artwork);
        return false;
      }
      
      return true;
    });
  }, [artworks]);

  // Calculate grid dimensions
  const { columnCount, itemWidth, itemHeight, rowCount } = useMemo(() => {
    if (containerWidth === 0) return { columnCount: 1, itemWidth: 300, itemHeight: 400, rowCount: 0 };
    
    const minItemWidth = isMobile ? 280 : 320;
    const cols = Math.max(1, Math.floor(containerWidth / minItemWidth));
    const width = Math.floor(containerWidth / cols);
    const height = Math.floor(width * 1.4);
    const rows = Math.ceil(validArtworks.length / cols);
    
    return {
      columnCount: cols,
      itemWidth: width,
      itemHeight: height,
      rowCount: rows
    };
  }, [containerWidth, validArtworks.length, isMobile]);

  // Group artworks by artist's sort letter with comprehensive null safety and sort by price descending
  const groupedArtworks = useMemo(() => {
    if (!Array.isArray(validArtworks) || !Array.isArray(artists)) {
      return {};
    }

    const grouped = validArtworks.reduce((acc: { [key: string]: Artwork[] }, artwork) => {
      if (!artwork) return acc;
      
      let artistName = "Unknown Artist";
      let sortLetter: string | null = null;
      
      // Safe access to artist_id with comprehensive null checks
      if (artwork.artist_id && artists && Array.isArray(artists)) {
        const artist = artists.find(a => a && typeof a === 'object' && a.id === artwork.artist_id);
        if (artist && typeof artist === 'object') {
          artistName = artist.full_name || "Unknown Artist";
          sortLetter = artist.surname_first_letter;
        }
      }
      
      const firstLetter = (sortLetter && typeof sortLetter === 'string' && sortLetter.trim() !== "") 
        ? sortLetter.trim().toUpperCase() 
        : artistName.charAt(0).toUpperCase();
      
      if (!acc[firstLetter]) {
        acc[firstLetter] = [];
      }
      acc[firstLetter].push(artwork);
      return acc;
    }, {});

    // Sort within each group with null safety - by artist name, then by price descending
    Object.keys(grouped).forEach(letter => {
      if (Array.isArray(grouped[letter])) {
        grouped[letter].sort((a, b) => {
          if (!a || !b || !Array.isArray(artists)) return 0;
          
          const artistDetailsA = artists.find(artist => artist && typeof artist === 'object' && artist.id === a.artist_id);
          const artistDetailsB = artists.find(artist => artist && typeof artist === 'object' && artist.id === b.artist_id);

          const artistNameA = (artistDetailsA && typeof artistDetailsA === 'object') ? (artistDetailsA.full_name || "Unknown Artist") : "Unknown Artist";
          const artistNameB = (artistDetailsB && typeof artistDetailsB === 'object') ? (artistDetailsB.full_name || "Unknown Artist") : "Unknown Artist";
          
          // First sort by artist name
          const artistCompare = artistNameA.localeCompare(artistNameB);
          if (artistCompare !== 0) return artistCompare;
          
          // Then sort by price descending (higher prices first)
          const priceA = (a && typeof a.price === 'number') ? a.price : 0;
          const priceB = (b && typeof b.price === 'number') ? b.price : 0;
          return priceB - priceA;
        });
      }
    });

    return grouped;
  }, [validArtworks, artists]);

  // Flatten grouped artworks for virtualization with additional safety
  const flattenedArtworks = useMemo(() => {
    if (!groupedArtworks || typeof groupedArtworks !== 'object') {
      return [];
    }
    
    return Object.entries(groupedArtworks)
      .sort()
      .flatMap(([letter, works]) => {
        if (!Array.isArray(works)) return [];
        return works.filter(artwork => artwork && typeof artwork === 'object' && artwork.id);
      });
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

  if (!validArtworks.length) {
    return (
      <div id="virtualized-grid-container" className="w-full">
        <div className="text-center py-8 text-muted-foreground">No valid artworks to display</div>
      </div>
    );
  }

  const totalHeight = rowCount * itemHeight;
  const { startIndex, endIndex } = visibleRange;

  return (
    <div id="virtualized-grid-container" className="w-full">
      <div
        ref={scrollElementRef}
        className="overflow-auto"
        style={{ height: containerHeight }}
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {Array.from({ length: Math.max(0, endIndex - startIndex + 1) }, (_, i) => {
            const index = startIndex + i;
            if (index >= flattenedArtworks.length || index < 0) return null;
            
            const artwork = flattenedArtworks[index];
            if (!artwork || !artwork.id) return null;
            
            const row = Math.floor(index / columnCount);
            const col = index % columnCount;
            
            return (
              <div
                key={`${artwork.id}-${index}`}
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
