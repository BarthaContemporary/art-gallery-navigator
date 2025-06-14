
import React from 'react';
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
}

export function ArtworksSection({
  collectionId,
  artworks,
  isArtworksLoading,
  artworksError,
  showPrices,
  onArtworkClick,
}: ArtworksSectionProps) {
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
      {isArtworksLoading && (
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
    </div>
  );
}
