
import React from 'react';
import type { PublicArtwork } from '@/hooks/artworks/useFetchArtworksByCollectionId';
import type { ArtworkImage } from "@/hooks/use-artwork-images";
import { OptimizedArtworkImage } from '@/components/artworks/OptimizedArtworkImage';

interface ArtworkGridItemCardProps {
  artwork: PublicArtwork;
  showPrices: boolean | undefined;
  onArtworkClick: (artwork: PublicArtwork) => void;
}

export function ArtworkGridItemCard({ artwork, showPrices, onArtworkClick }: ArtworkGridItemCardProps) {
  const primaryImageFetched = artwork.artwork_images?.find(img => img.is_primary) || artwork.artwork_images?.[0];
  
  const imageRecordToPass: ArtworkImage | undefined =
    primaryImageFetched && primaryImageFetched.image_url
      ? {
          id: primaryImageFetched.id,
          artwork_id: artwork.id,
          image_url: primaryImageFetched.image_url, // Now guaranteed to be string due to the check
          is_primary: primaryImageFetched.is_primary ?? false,
          display_order: primaryImageFetched.display_order ?? 0,
          thumbnail_url: primaryImageFetched.thumbnail_url, // Optional
          medium_url: primaryImageFetched.medium_url,       // Optional
          processed: !!(primaryImageFetched.thumbnail_url || primaryImageFetched.medium_url),
        }
      : undefined;

  return (
    <div className="group cursor-pointer" onClick={() => onArtworkClick(artwork)}>
      <div className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors duration-200 overflow-hidden">
        <OptimizedArtworkImage
          imageRecord={imageRecordToPass}
          title={artwork.title || 'Untitled'}
          onClick={() => onArtworkClick(artwork)} // Redundant onClick, but OptimizedArtworkImage expects it. Could be refactored there.
        />
        <div className="p-4">
          <h3 className="font-medium text-lg mb-1 text-gray-900">
            {artwork.title || 'Untitled'}
          </h3>
          {artwork.artist && (
            <p className="text-sm text-gray-600 mb-2">
              {artwork.artist.full_name}
            </p>
          )}
          {artwork.year && (
            <p className="text-sm text-gray-500">
              {artwork.year}
            </p>
          )}
          {artwork.medium_type && (
            <p className="text-xs text-gray-400 mt-1">
              {artwork.medium_type}
            </p>
          )}
          {showPrices && artwork.price && (
            <p className="text-sm font-medium text-gray-900 mt-2">
              {artwork.currency} {artwork.price.toLocaleString()}
            </p>
          )}
          {imageRecordToPass?.image_url?.includes('res.cloudinary.com') && (
            <div className="text-xs text-green-600 mt-1 opacity-70">
              ✓ Cloudinary Optimized
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
