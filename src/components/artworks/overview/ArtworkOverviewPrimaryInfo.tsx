
import React from 'react';
import { Artwork } from '@/hooks/use-artworks';
import { Artist } from '@/hooks/use-artist';
import { ArtworkField } from './ArtworkField';

interface ArtworkOverviewPrimaryInfoProps {
  artwork: Artwork;
  artist: Artist | null | undefined;
  artistLoading: boolean;
}

function getTruncatedTitleWithYear(title: string, year: string | number | null, maxLength = 44) {
  if (!title) return year ? `Untitled, ${year}` : "Untitled";
  let fullTitle = title;
  const yearStr = year ? `, ${year}` : "";
  const remaining = maxLength - yearStr.length;
  let displayTitle = title.length > remaining ? title.slice(0, Math.max(0, remaining - 3)) + "..." : title;
  return `${displayTitle}${yearStr}`;
}

export const ArtworkOverviewPrimaryInfo: React.FC<ArtworkOverviewPrimaryInfoProps> = ({ artwork, artist, artistLoading }) => {
  
  const formatDimensionsDisplay = (art: Artwork) => {
    const parts = [];
    if (art.height) parts.push(Number(art.height).toString());
    if (art.width) parts.push(Number(art.width).toString());
    if (art.depth) parts.push(Number(art.depth).toString());
    return parts.length > 0 ? `${parts.join(' x ')} cm` : "N/A";
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

  const truncatedTitleWithYear = getTruncatedTitleWithYear(
    artwork.title,
    artwork.year,
    44
  );

  const isAvailable = (artwork.status ?? "available").toLowerCase() === "available";
  const shouldShowPrice = isAvailable && artwork.price;

  return (
    <div className="space-y-3">
      <ArtworkField label="Artist" value={artistLoading ? "Loading..." : artist?.full_name || "Unknown Artist"} />
      <ArtworkField 
        label="Title, Year"
        value={
          <span className="inline-block w-full truncate" title={artwork.title + (artwork.year ? `, ${artwork.year}` : "")}>
            {truncatedTitleWithYear}
          </span>
        }
      />
      <ArtworkField label="Materials" value={artwork.materials} multiline />
      <ArtworkField label="Edition Information" value={formatEditionInfoDisplay(artwork)} multiline />
      <ArtworkField label="Dimensions" value={formatDimensionsDisplay(artwork)} />
      <ArtworkField label="Medium Type" value={artwork.medium_type} />
      {shouldShowPrice && (
        <ArtworkField label="Price" value={`${artwork.currency} ${artwork.price.toLocaleString()}`} />
      )}
    </div>
  );
};
