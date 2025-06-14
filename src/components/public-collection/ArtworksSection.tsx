import React, { useRef, useEffect, useCallback } from 'react';
import { Loader2, AlertTriangle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle as ShadcnAlertTitle } from '@/components/ui/alert';
import type { PublicArtwork } from '@/hooks/artworks/useFetchArtworksByCollectionId';
import { ArtworkGridItemCard } from './ArtworkGridItemCard';

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
    if (target.isIntersecting) {
      console.log('[ArtworksSection] Sentinel element IS intersecting.');
      if (hasMoreArtworks && !isArtworksLoading) {
        console.log('[ArtworksSection] Conditions met: hasMoreArtworks=true, isArtworksLoading=false. Calling onLoadMore.');
        onLoadMore();
      } else {
        console.log(`[ArtworksSection] Conditions NOT met for onLoadMore: hasMoreArtworks=${hasMoreArtworks}, isArtworksLoading=${isArtworksLoading}.`);
      }
    } else {
      // console.log('[ArtworksSection] Sentinel element is NOT intersecting.'); // This can be noisy
    }
  }, [onLoadMore, hasMoreArtworks, isArtworksLoading]);

  useEffect(() => {
    console.log('[ArtworksSection] Initializing IntersectionObserver effect.');
    if (observerRef.current) {
        console.log('[ArtworksSection] Disconnecting previous observer.');
        observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(handleObserver, {
      root: null, 
      rootMargin: '0px 0px 200px 0px', // Start loading when 200px from bottom of viewport
      threshold: 0.01, // Trigger when even a small part is visible
    });
    console.log('[ArtworksSection] IntersectionObserver created.');

    const currentLoadMoreRef = loadMoreRef.current;
    if (currentLoadMoreRef) {
      console.log('[ArtworksSection] Attaching observer to loadMoreRef.');
      observerRef.current.observe(currentLoadMoreRef);
    } else {
      console.log('[ArtworksSection] loadMoreRef is null, cannot attach observer yet.');
    }

    return () => {
      console.log('[ArtworksSection] Cleanup: Disconnecting IntersectionObserver.');
      if (observerRef.current && currentLoadMoreRef) {
        observerRef.current.unobserve(currentLoadMoreRef);
      }
       if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleObserver]); // handleObserver dependency is correct
  
  useEffect(() => {
    const currentObserver = observerRef.current;
    const currentLoadMoreRef = loadMoreRef.current;

    if (currentObserver && currentLoadMoreRef) {
      currentObserver.unobserve(currentLoadMoreRef); // Always unobserve first
      if (hasMoreArtworks) {
        console.log('[ArtworksSection] Re-observing loadMoreRef because hasMoreArtworks is true.');
        currentObserver.observe(currentLoadMoreRef);
      } else {
        console.log('[ArtworksSection] Not re-observing loadMoreRef because hasMoreArtworks is false.');
      }
    } else {
        console.log(`[ArtworksSection] Cannot re-observe: currentObserver=${!!currentObserver}, currentLoadMoreRef=${!!currentLoadMoreRef}, hasMoreArtworks=${hasMoreArtworks}`);
    }
  }, [hasMoreArtworks, artworks]); // Re-evaluate when hasMoreArtworks or artworks list changes

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
      
      <div ref={loadMoreRef} className="h-20 flex items-center justify-center" data-testid="load-more-sentinel">
        {hasMoreArtworks && isArtworksLoading && ( // This is when loading the *next* batch
          <div className="flex items-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            <span>Loading more artworks...</span>
          </div>
        )}
        {!hasMoreArtworks && artworks && artworks.length > 0 && !isArtworksLoading && (
          <p className="text-sm text-muted-foreground">All artworks loaded.</p>
        )}
         {hasMoreArtworks && !isArtworksLoading && ( // Visible when there's more to load but not currently loading
          <p className="text-sm text-muted-foreground">Scroll down to load more.</p>
        )}
      </div>
    </div>
  );
}
