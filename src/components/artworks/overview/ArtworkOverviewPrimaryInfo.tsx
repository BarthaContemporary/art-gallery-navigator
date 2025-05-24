
import React from 'react';
import { Artwork } from '@/hooks/use-artworks';
import { Artist } from '@/hooks/use-artist'; // Assuming this is the correct type path
import { ArtworkField } from './ArtworkField'; // Using the new helper

interface ArtworkOverviewPrimaryInfoProps {
  artwork: Artwork;
  artist: Artist | null | undefined;
  artistLoading: boolean;
}

export const ArtworkOverviewPrimaryInfo: React.FC<ArtworkOverviewPrimaryInfoProps> = ({ artwork, artist, artistLoading }) => {
  
  const formatDimensionsDisplay = (art: Artwork) => {
    const parts = [];
    if (art.height) parts.push(`Height: ${art.height}`);
    if (art.width) parts.push(`Width: ${art.width}`);
    if (art.depth) parts.push(`Depth: ${art.depth}`);
    // If a unit (e.g., "cm") is available, add it here. art.dimensions_unit
    // const unit = art.dimensions_unit || "cm"; // Assuming cm if not specified
    // return parts.length > 0 ? parts.map(p => p + ` ${unit}`).join(', ') : 'N/A';
    return parts.join(' / ') || "N/A";
  };

  const formatEditionInfoDisplay = (art: Artwork) => {
    if (art.classification === 'Unique') {
      return "Unique";
    }
    const info = [
      `Edition Size: ${art.edition_size || 'N/A'}`,
      `Available Works: ${art.available_works || 'N/A'}`,
      `Inventory Quantity: ${art.inventory_quantity || 0}`,
      `Artist Proofs: ${art.artist_proofs || 0}`,
    ];
    return info.join('\n');
  };

  return (
    <div className="space-y-3">
      <ArtworkField label="Artist" value={artistLoading ? "Loading..." : artist?.full_name || "Unknown Artist"} />
      <ArtworkField label="Title, Year" value={`${artwork.title}${artwork.year ? `, ${artwork.year}` : ''}`} />
      <ArtworkField label="Materials" value={artwork.materials} multiline />
      
      <ArtworkField label="Edition Information" value={formatEditionInfoDisplay(artwork)} multiline />
      
      <ArtworkField label="Dimensions" value={formatDimensionsDisplay(artwork)} />
      <ArtworkField label="Medium Type" value={artwork.medium_type} />

      {artwork.price && (
        <ArtworkField label="Price" value={`${artwork.currency} ${artwork.price.toLocaleString()}`} />
      )}
    </div>
  );
};
