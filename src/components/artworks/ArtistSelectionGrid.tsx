/**
 * Artist Selection Grid
 * Displays a three-column alphabetical list of artist names grouped by surname first letter.
 */

import React, { useMemo } from "react";
import type { Artist } from "@/types/artwork";

interface ArtistSelectionGridProps {
  artists: Artist[];
  searchQuery: string;
  onSelectArtist: (artistId: string) => void;
}

export function ArtistSelectionGrid({ artists, searchQuery, onSelectArtist }: ArtistSelectionGridProps) {
  const filteredAndGrouped = useMemo(() => {
    // Filter by search
    const filtered = searchQuery
      ? artists.filter(a => a.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
      : artists;

    // Group by surname first letter
    const groups: Record<string, Artist[]> = {};
    for (const artist of filtered) {
      const letter = (artist.surname_first_letter || artist.full_name.charAt(0) || '#').toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(artist);
    }

    // Sort letters and artists within each group
    return Object.keys(groups)
      .sort()
      .map(letter => ({
        letter,
        artists: groups[letter].sort((a, b) => a.full_name.localeCompare(b.full_name)),
      }));
  }, [artists, searchQuery]);

  if (filteredAndGrouped.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        {searchQuery ? `No artists matching "${searchQuery}"` : 'No artists found'}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {filteredAndGrouped.map(({ letter, artists: groupArtists }) => (
        <div key={letter}>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 border-b border-border pb-1">
            {letter}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
            {groupArtists.map(artist => (
              <button
                key={artist.id}
                onClick={() => onSelectArtist(artist.id)}
                className="text-left px-3 py-2.5 rounded-md text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors truncate min-h-[44px] flex items-center"
              >
                {artist.full_name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
