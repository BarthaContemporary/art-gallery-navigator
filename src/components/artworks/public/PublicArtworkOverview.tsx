
import React from "react";
import type { PublicArtwork } from "@/hooks/artworks/useFetchArtworksByCollectionId";

interface PublicArtworkOverviewProps {
  artwork: PublicArtwork;
  showPrices?: boolean;
}

export function PublicArtworkOverview({ artwork, showPrices = true }: PublicArtworkOverviewProps) {
  return (
    <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Artwork Overview</h3>
        <p className="text-gray-500">Coming soon...</p>
      </div>
    </div>
  );
}
