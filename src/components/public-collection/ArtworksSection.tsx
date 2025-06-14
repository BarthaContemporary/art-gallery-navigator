
import React, { useRef, useEffect, useCallback } from 'react';
import { Loader2, AlertTriangle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle as ShadcnAlertTitle } from '@/components/ui/alert';
import type { PublicArtwork } from '@/hooks/artworks/useFetchArtworksByCollectionId';
import { ArtworkGridItemCard } from './ArtworkGridItemCard';
// Removed Button import as it's no longer used for "Load More"

interface ArtworksSectionProps {
  collectionId: string | undefined;
  artworks: PublicArtwork[] | undefined;
  isArtworksLoading: boolean;
  artworksError: Error | null;
  showPrices: boolean | undefined;
  onArtworkClick: (artwork: PublicArtwork) => void;
  onLoadMore: () => void;
  hasMoreArtworks: boolean;
}

export function ArtworksSection({
  collectionId,
  artworks,
  isArtworksLoading,
  artworksError,
  showPrices,
  onArtworkClick,
  onLoadMore,
  hasMoreArtworks,
}: ArtworksSectionProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting && hasMoreArtworks && !isArtworksLoading) {
      console.log('[ArtworksSection] Load more triggered by intersection observer');
      onLoadMore();
    }
  }, [onLoadMore, hasMoreArtworks, isArtworksLoading]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(handleObserver, {
      root: null, // viewport
      rootMargin: '0px',
      threshold: 0.1, // Trigger when 10% of the element is visible
    });

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current && loadMoreRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        observerRef.current.unobserve(loadMoreRef.current);
      }
    };
  }, [handleObserver]);
  
  // Re-observe if loadMoreRef or hasMoreArtworks changes and observer is set
  useEffect(() => {
    if (loadMoreRef.current && observerRef.current && hasMoreArtworks) {
      observerRef.current.observe(loadMoreRef.current);
    } else if (loadMoreRef.current && observerRef.current && !hasMoreArtworks) {
      observerRef.current.unobserve(loadMoreRef.current);
    }
  }, [hasMoreArtworks, artworks]); // also re-observe if artworks list changes, ensuring ref is attached if needed


  if (!collectionId) {
    return (
      <div className="mt-8 text-center text-muted-foreground">
        <Info className="h-8 w-8 mx-auto mb-2 text-primary" />
        <p>Artworks cannot be displayed as no collection is linked to this website.</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6">Artworks</h2>
      {isArtworksLoading && (!artworks || artworks.length === 0) && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <p className="text-muted-foreground">Loading artworks...</p>
        </div>
      )}
      {artworksError && (
        <Alert variant="destructive" className="my-6">
          <AlertTriangle className="h-5 w-5" />
          <ShadcnAlertTitle>Error Loading Artworks</ShadcnAlertTitle>
          <AlertDescription>
            Failed to load artworks: {artworksError.message}
          </AlertDescription>
        </Alert>
      )}
      {!isArtworksLoading && !artworksError && artworks && artworks.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 lg:gap-6">
          {artworks.map(artwork => (
            <ArtworkGridItemCard
              key={artwork.id}
              artwork={artwork}
              showPrices={showPrices}
              onArtworkClick={onArtworkClick}
            />
          ))}
        </div>
      )}
      {!isArtworksLoading && !artworksError && (!artworks || artworks.length === 0) && (
         <div className="mt-6 p-6 border rounded-md bg-muted/50 text-muted-foreground flex flex-col items-center text-center">
           <Info className="h-10 w-10 mb-3 text-primary" />
           <p className="text-lg font-medium">No Artworks to Display</p>
           <p className="text-sm">
             This collection currently has no artworks, or they could not be loaded.
           </p>
         </div>
      )}
      
      {/* Sentinel element for IntersectionObserver and loading indicator */}
      <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
        {hasMoreArtworks && isArtworksLoading && (
          <div className="flex items-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            <span>Loading more artworks...</span>
          </div>
        )}
        {/* Optionally, show a message when no more artworks and not loading initial set */}
        {!hasMoreArtworks && artworks && artworks.length > 0 && !isArtworksLoading && (
          <p className="text-sm text-muted-foreground">All artworks loaded.</p>
        )}
      </div>
    </div>
  );
}

