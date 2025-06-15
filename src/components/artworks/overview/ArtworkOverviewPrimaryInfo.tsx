
import React from 'react';
import { Artwork } from '@/hooks/use-artworks';
import { Artist } from '@/hooks/use-artist'; // Assuming this is the correct type path
import { ArtworkField } from './ArtworkField'; // Using the new helper

interface ArtworkOverviewPrimaryInfoProps {
  artwork: Artwork;
  artist: Artist | null | undefined;
  artistLoading: boolean;
}

// Helper to truncate title and ensure one-line "title, year"
function getTruncatedTitleWithYear(title: string, year: string | number | null, maxLength = 44) {
  if (!title) return year ? `Untitled, ${year}` : "Untitled";
  let fullTitle = title;
  // Reserve chars for ", YYYY" if year exists
  const yearStr = year ? `, ${year}` : "";
  // Truncate title if needed
  const remaining = maxLength - yearStr.length;
  let displayTitle = title.length > remaining ? title.slice(0, Math.max(0, remaining - 3)) + "..." : title;
  return `${displayTitle}${yearStr}`;
}

export const ArtworkOverviewPrimaryInfo: React.FC<ArtworkOverviewPrimaryInfoProps> = ({ artwork, artist, artistLoading }) => {
  
  const formatDimensionsDisplay = (art: Artwork) => {
    const parts = [];
    if (art.height) parts.push(`Height: ${art.height}`);
    if (art.width) parts.push(`Width: ${art.width}`);
    if (art.depth) parts.push(`Depth: ${art.depth}`);
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

  // Truncate and keep title/year together on one line
  const truncatedTitleWithYear = getTruncatedTitleWithYear(
    artwork.title,
    artwork.year,
    44 // You can tweak this for best fit in dialog
  );

  // Only display price if status is "available"
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
