
import React from "react";
import { ArtworkCarousel } from "../ArtworkCarousel";
import type { PublicArtwork } from "@/hooks/artworks/useFetchArtworksByCollectionId";

interface PublicArtworkOverviewProps {
  artwork: PublicArtwork;
  showPrices?: boolean;
}

export function PublicArtworkOverview({ artwork, showPrices = true }: PublicArtworkOverviewProps) {
  return (
    <div className="space-y-6">
      {/* Image Carousel */}
      <div className="mb-6">
        <ArtworkCarousel 
          artworkId={artwork.id} 
          artistName={artwork.artist?.full_name || "Unknown Artist"} 
          artworkTitle={artwork.title}
          isDialogActive={true}
        />
      </div>
      
      {/* Primary Details */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {artwork.title}
          </h2>
          {artwork.artist && (
            <p className="text-lg text-gray-600 mb-3">
              {artwork.artist.full_name}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {artwork.year && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Year</dt>
              <dd className="text-sm text-gray-900">{artwork.year}</dd>
            </div>
          )}
          
          {artwork.medium_type && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Medium</dt>
              <dd className="text-sm text-gray-900">{artwork.medium_type}</dd>
            </div>
          )}
          
          {artwork.materials && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Materials</dt>
              <dd className="text-sm text-gray-900">{artwork.materials}</dd>
            </div>
          )}
          
          {showPrices && artwork.price && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Price</dt>
              <dd className="text-sm font-semibold text-gray-900">
                {artwork.currency} {artwork.price.toLocaleString()}
              </dd>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
