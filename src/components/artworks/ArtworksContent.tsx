
import { Artwork } from "@/hooks/use-artworks";
import { ViewMode } from "./ArtworkViewToggle";
import { ArtworkGrid } from "./ArtworkGrid";
import { VirtualizedArtworkGrid } from "./VirtualizedArtworkGrid";
import { ArtworkListView } from "./ArtworkListView";
import { AlphabeticalIndex } from "./AlphabeticalIndex";

interface ArtworksContentProps {
  artworks: Artwork[];
  viewMode: ViewMode;
  useVirtualization: boolean;
  containerHeight: number;
  letters: string[];
  activeIndex?: string;
  onActiveIndexChange: (index: string) => void;
  onScrollToTop: () => void;
}

export function ArtworksContent({
  artworks,
  viewMode,
  useVirtualization,
  containerHeight,
  letters,
  activeIndex,
  onActiveIndexChange,
  onScrollToTop
}: ArtworksContentProps) {
  const renderContent = () => {
    if (viewMode === 'list') {
      return <ArtworkListView artworks={artworks} />;
    }

    if (viewMode === 'grid') {
      if (useVirtualization && artworks.length > 50) {
        return (
          <VirtualizedArtworkGrid 
            artworks={artworks} 
            containerHeight={containerHeight}
            onScrollToTop={onScrollToTop}
          />
        );
      }
      return (
        <ArtworkGrid 
          artworks={artworks} 
          activeIndex={activeIndex} 
          onScrollToTop={onScrollToTop} 
        />
      );
    }

    return <ArtworkListView artworks={artworks} />;
  };

  return (
    <>
      {viewMode === 'grid' && letters.length > 0 && !useVirtualization && (
        <AlphabeticalIndex 
          letters={letters} 
          onLetterClick={onActiveIndexChange} 
          activeLetter={activeIndex}
        />
      )}
      {renderContent()}
    </>
  );
}
