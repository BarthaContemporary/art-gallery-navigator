
import { useMemo } from 'react';
import { Artwork } from '@/hooks/use-artworks';
import { Artist } from '@/hooks/useArtists'; // Assuming Artist type is available

export function useGroupedAndSortedArtworks(
  validArtworks: Artwork[],
  artists: Artist[] | undefined
): Artwork[] {
  const groupedArtworks = useMemo(() => {
    if (!Array.isArray(validArtworks) || !artists || !Array.isArray(artists)) {
      return {};
    }

    const grouped = validArtworks.reduce((acc: { [key: string]: Artwork[] }, artwork) => {
      if (!artwork) return acc;
      
      let artistName = "Unknown Artist";
      let sortLetter: string | null = null;
      
      if (artwork.artist_id) {
        const artist = artists.find(a => a && typeof a === 'object' && a.id === artwork.artist_id);
        if (artist && typeof artist === 'object') {
          artistName = artist.full_name || "Unknown Artist";
          sortLetter = artist.surname_first_letter;
        }
      }
      
      const firstLetter = (sortLetter && typeof sortLetter === 'string' && sortLetter.trim() !== "") 
        ? sortLetter.trim().toUpperCase() 
        : (artistName || "Unknown Artist").charAt(0).toUpperCase();
      
      if (!acc[firstLetter]) {
        acc[firstLetter] = [];
      }
      acc[firstLetter].push(artwork);
      return acc;
    }, {});

    Object.keys(grouped).forEach(letter => {
      if (Array.isArray(grouped[letter])) {
        grouped[letter].sort((a, b) => {
          if (!a || !b) return 0;
          
          const artistDetailsA = artists.find(artist => artist && typeof artist === 'object' && artist.id === a.artist_id);
          const artistDetailsB = artists.find(artist => artist && typeof artist === 'object' && artist.id === b.artist_id);

          const artistNameA = (artistDetailsA && artistDetailsA.full_name) ? artistDetailsA.full_name : "Unknown Artist";
          const artistNameB = (artistDetailsB && artistDetailsB.full_name) ? artistDetailsB.full_name : "Unknown Artist";
          
          const artistCompare = artistNameA.localeCompare(artistNameB);
          if (artistCompare !== 0) return artistCompare;
          
          const priceA = (a && typeof a.price === 'number') ? a.price : 0;
          const priceB = (b && typeof b.price === 'number') ? b.price : 0;
          return priceB - priceA; // Sort by price descending
        });
      }
    });
    return grouped;
  }, [validArtworks, artists]);

  return useMemo(() => {
    if (!groupedArtworks || typeof groupedArtworks !== 'object') {
      return [];
    }
    
    return Object.entries(groupedArtworks)
      .sort(([letterA], [letterB]) => letterA.localeCompare(letterB)) // Sort groups by letter
      .flatMap(([_, works]) => { 
        if (!Array.isArray(works)) return [];
        // Ensure artworks are valid objects with IDs before returning
        return works.filter(artwork => artwork && typeof artwork === 'object' && artwork.id);
      });
  }, [groupedArtworks]);
}
