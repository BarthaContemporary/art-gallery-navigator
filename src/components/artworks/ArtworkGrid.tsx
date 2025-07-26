import React, { useMemo } from "react";
import { ChevronUp, CheckSquare } from "lucide-react";
import { Artwork } from "@/types/artwork";
import { ArtworkCard } from "./ArtworkCard";
import { ArtworkSelectionCard } from "./selection/ArtworkSelectionCard";
import { Button } from "@/components/ui/button";

interface ArtworkGridProps {
  artworks: Artwork[];
  loading?: boolean;
  onScrollToTop?: () => void;
  // Selection props
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (artworkId: string) => void;
  onEnterSelectionMode?: () => void;
}

export function ArtworkGrid({ 
  artworks, 
  loading, 
  onScrollToTop,
  isSelectionMode = false,
  selectedIds = new Set(),
  onToggleSelection,
  onEnterSelectionMode 
}: ArtworkGridProps) {
  const groupedArtworks = useMemo(() => {
    if (!artworks || artworks.length === 0) return [];

    // Group artworks by artist name
    const groups = artworks.reduce((acc, artwork) => {
      const artistName = artwork.artist_name || artwork.artists?.full_name || "Unknown Artist";
      if (!acc[artistName]) {
        acc[artistName] = [];
      }
      acc[artistName].push(artwork);
      return acc;
    }, {} as Record<string, Artwork[]>);

    // Sort artists by surname_first_letter, then by full name
    return Object.entries(groups)
      .sort(([artistNameA, artworksA], [artistNameB, artworksB]) => {
        const artistA = artworksA[0]?.artists;
        const artistB = artworksB[0]?.artists;
        
        const sortLetterA = artistA?.surname_first_letter || artistNameA.charAt(0).toUpperCase();
        const sortLetterB = artistB?.surname_first_letter || artistNameB.charAt(0).toUpperCase();
        
        // First sort by surname_first_letter
        if (sortLetterA !== sortLetterB) {
          return sortLetterA.localeCompare(sortLetterB);
        }
        
        // Then sort by full name
        return artistNameA.localeCompare(artistNameB);
      })
      .map(([artistName, artworks]) => ({
        artistName,
        artworks: artworks.sort((a, b) => a.title.localeCompare(b.title))
      }));
  }, [artworks]);

  const scrollToTop = () => {
    if (onScrollToTop) {
      onScrollToTop();
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-12">
        {Array.from({ length: 3 }).map((_, groupIndex) => (
          <div key={groupIndex} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-8 bg-muted animate-pulse rounded w-48" />
              <div className="h-6 bg-muted animate-pulse rounded w-24" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!artworks || artworks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No artworks found</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {groupedArtworks.map(({ artistName, artworks }) => (
        <div key={artistName} className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-foreground">{artistName}</h2>
              <p className="text-sm text-muted-foreground">
                {artworks.length} {artworks.length === 1 ? 'work' : 'works'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isSelectionMode && onEnterSelectionMode && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onEnterSelectionMode}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <CheckSquare className="h-4 w-4 mr-1" />
                  Select
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={scrollToTop}
                className="text-muted-foreground hover:text-foreground"
              >
                <ChevronUp className="h-4 w-4 mr-1" />
                Top
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {artworks.map((artwork) => (
              isSelectionMode ? (
                <ArtworkSelectionCard
                  key={artwork.id}
                  artwork={artwork}
                  isSelected={selectedIds.has(artwork.id)}
                  isSelectionMode={isSelectionMode}
                  onToggleSelection={onToggleSelection || (() => {})}
                />
              ) : (
                <ArtworkCard key={artwork.id} artwork={artwork} />
              )
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}