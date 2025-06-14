
import React, { Suspense, lazy } from "react"; // Added React, Suspense, lazy
import { Artwork } from "@/hooks/use-artworks";
import { ViewMode } from "./ArtworkViewToggle";
// import { ArtworkGrid } from "./ArtworkGrid"; // To be lazy loaded
// import { VirtualizedArtworkGrid } from "./VirtualizedArtworkGrid"; // To be lazy loaded
// import { ArtworkListView } from "./ArtworkListView"; // To be lazy loaded
import { AlphabeticalIndex } from "./AlphabeticalIndex";
import { Loader2 } from "lucide-react"; // Added Loader2

const ArtworkGridLazy = lazy(() => import('./ArtworkGrid').then(module => ({ default: module.ArtworkGrid })));
const VirtualizedArtworkGridLazy = lazy(() => import('./VirtualizedArtworkGrid').then(module => ({ default: module.VirtualizedArtworkGrid })));
const ArtworkListViewLazy = lazy(() => import('./ArtworkListView').then(module => ({ default: module.ArtworkListView })));

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

const ContentLoadingFallback = () => (
  <div className="flex items-center justify-center h-64">
    <Loader2 className="h-12 w-12 animate-spin text-primary" />
  </div>
);

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
      return <ArtworkListViewLazy artworks={artworks} />;
    }

    if (viewMode === 'grid') {
      if (useVirtualization && artworks.length > 50) {
        return (
          <VirtualizedArtworkGridLazy 
            artworks={artworks} 
            containerHeight={containerHeight}
            onScrollToTop={onScrollToTop}
          />
        );
      }
      return (
        <ArtworkGridLazy 
          artworks={artworks} 
          activeIndex={activeIndex} 
          onScrollToTop={onScrollToTop} 
        />
      );
    }
    // Default to list view if viewMode is somehow unrecognized
    return <ArtworkListViewLazy artworks={artworks} />;
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
      <Suspense fallback={<ContentLoadingFallback />}>
        {renderContent()}
      </Suspense>
    </>
  );
}
