
import { useMemo } from 'react';
import { Artwork } from '@/hooks/use-artworks';
import { Artist } from '@/hooks/useArtists';

// Memoized artist name extraction to prevent recalculation
const getArtistName = (artwork: Artwork, artists: Artist[]): string => {
  if (!artwork.artist_id) return "Unknown Artist";
  const artist = artists.find(a => a && typeof a === 'object' && a.id === artwork.artist_id);
  return (artist && artist.full_name) ? artist.full_name : "Unknown Artist";
};

// Memoized sort letter extraction
const getSortLetter = (artwork: Artwork, artists: Artist[]): string => {
  if (!artwork.artist_id) return "U"; // Unknown
  const artist = artists.find(a => a && typeof a === 'object' && a.id === artwork.artist_id);
  if (artist && artist.surname_first_letter && typeof artist.surname_first_letter === 'string' && artist.surname_first_letter.trim() !== "") {
    return artist.surname_first_letter.trim().toUpperCase();
  }
  const artistName = getArtistName(artwork, artists);
  return artistName.charAt(0).toUpperCase();
};

export function useGroupedAndSortedArtworks(
  validArtworks: Artwork[],
  artists: Artist[] | undefined
): Artwork[] {
  // Memoize grouped artworks with improved performance
  const groupedArtworks = useMemo(() => {
    if (!Array.isArray(validArtworks) || !artists || !Array.isArray(artists)) {
      return {};
    }

    // Use more efficient grouping approach
    const grouped: { [key: string]: Artwork[] } = {};
    
    // Single pass through artworks for grouping
    for (const artwork of validArtworks) {
      if (!artwork) continue;
      
      const firstLetter = getSortLetter(artwork, artists);
      
      if (!grouped[firstLetter]) {
        grouped[firstLetter] = [];
      }
      grouped[firstLetter].push(artwork);
    }

    // Sort each group efficiently
    Object.keys(grouped).forEach(letter => {
      if (Array.isArray(grouped[letter])) {
        grouped[letter].sort((a, b) => {
          if (!a || !b) return 0;
          
          // Use memoized functions for better performance
          const artistNameA = getArtistName(a, artists);
          const artistNameB = getArtistName(b, artists);
          
          const artistCompare = artistNameA.localeCompare(artistNameB);
          if (artistCompare !== 0) return artistCompare;
          
          // Sort by type/medium_type
          const typeA = a.medium_type || "";
          const typeB = b.medium_type || "";
          const typeCompare = typeA.localeCompare(typeB);
          if (typeCompare !== 0) return typeCompare;
          
          // Then sort by price descending
          const priceA = (a && typeof a.price === 'number') ? a.price : 0;
          const priceB = (b && typeof b.price === 'number') ? b.price : 0;
          return priceB - priceA;
        });
      }
    });
    
    return grouped;
  }, [validArtworks, artists]);

  // Memoize final flattened result for better performance
  return useMemo(() => {
    if (!groupedArtworks || typeof groupedArtworks !== 'object') {
      return [];
    }
    
    // Use more efficient sorting and flattening
    const sortedEntries = Object.entries(groupedArtworks).sort(([letterA], [letterB]) => letterA.localeCompare(letterB));
    
    const result: Artwork[] = [];
    for (const [_, works] of sortedEntries) {
      if (Array.isArray(works)) {
        for (const artwork of works) {
          if (artwork && typeof artwork === 'object' && artwork.id) {
            result.push(artwork);
          }
        }
      }
    }
    
    return result;
  }, [groupedArtworks]);
}
