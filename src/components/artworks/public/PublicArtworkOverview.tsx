
import React from "react";
import { ArtworkImageViewer } from "../overview/ArtworkImageViewer";
import type { PublicArtwork } from "@/hooks/artworks/useFetchArtworksByCollectionId";
import { useLocation } from "@/hooks/use-location";

interface PublicArtworkOverviewProps {
  artwork: PublicArtwork;
  showPrices?: boolean;
}

export function PublicArtworkOverview({ artwork, showPrices = true }: PublicArtworkOverviewProps) {
  const { data: location, isLoading: locationLoading } = useLocation(artwork.location_id);

  const formatDimensions = (artwork: PublicArtwork) => {
    const parts = [];
    if (artwork.height) parts.push(`H: ${artwork.height}`);
    if (artwork.width) parts.push(`W: ${artwork.width}`);
    if (artwork.depth) parts.push(`D: ${artwork.depth}`);
    return parts.length > 0 ? parts.join(' × ') : null;
  };

  const formatFramingInfo = (artwork: PublicArtwork) => {
    if (!artwork.is_framed) return null;
    
    const frameParts = [];
    if (artwork.frame_height) frameParts.push(`H: ${artwork.frame_height}`);
    if (artwork.frame_width) frameParts.push(`W: ${artwork.frame_width}`);
    if (artwork.frame_depth) frameParts.push(`D: ${artwork.frame_depth}`);
    
    if (frameParts.length > 0) {
      return `Framed (${frameParts.join(' × ')})`;
    }
    return "Framed";
  };

  return (
    <div className="space-y-6">
      {/* Image Viewer */}
      <div className="mb-6">
        <ArtworkImageViewer 
          artworkId={artwork.id} 
          artistName={artwork.artist?.full_name || "Unknown Artist"} 
          artworkTitle={artwork.title}
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

          {formatDimensions(artwork) && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Dimensions</dt>
              <dd className="text-sm text-gray-900">{formatDimensions(artwork)}</dd>
            </div>
          )}

          {formatFramingInfo(artwork) && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Framing</dt>
              <dd className="text-sm text-gray-900">{formatFramingInfo(artwork)}</dd>
            </div>
          )}

          {artwork.location_id && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Location</dt>
              <dd className="text-sm text-gray-900">
                {locationLoading ? "Loading..." : location?.name || "Unknown Location"}
              </dd>
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
