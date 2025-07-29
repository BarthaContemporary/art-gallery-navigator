
import React from "react";
import { Artwork } from "@/hooks/use-artworks";
import { Check, X } from "lucide-react";
import { getTruncatedTitleWithYear } from "@/lib/utils";
import { ConvertedPrice } from "./ConvertedPrice";

interface ArtworkCardInfoProps {
  artwork: Artwork;
  artistName: string;
  available: boolean;
}

export function ArtworkCardInfo({ artwork, artistName, available }: ArtworkCardInfoProps) {
  // Year, Dimensions, etc
  let year = artwork.year ? artwork.year : "";
  let dimensions = "";
  if (
    artwork.height != null ||
    artwork.width != null ||
    artwork.depth != null
  ) {
    const dList = [];
    if (artwork.height != null) dList.push(Number(artwork.height).toLocaleString(undefined, { maximumFractionDigits: 2 }));
    if (artwork.width != null) dList.push(Number(artwork.width).toLocaleString(undefined, { maximumFractionDigits: 2 }));
    if (artwork.depth != null) dList.push(Number(artwork.depth).toLocaleString(undefined, { maximumFractionDigits: 2 }));
    dimensions = dList.length > 0 ? `${dList.join(" x ")} cm` : "";
  } else if (artwork.dimensions) {
    dimensions = artwork.dimensions;
  }

  // Truncate title separately since year will be on its own line
  const truncatedTitle = artwork.title.length > 30 ? artwork.title.substring(0, 30) + '...' : artwork.title;

  // Info section fixed height (matches parent design)
  const INFO_HEIGHT_PX = Math.round((2 / 3) * 256); // 256px image height

  return (
    <div
      className="flex flex-col justify-between px-4 py-4 flex-shrink-0"
      style={{ height: `${INFO_HEIGHT_PX}px` }}
    >
      <div className="space-y-2">
        <p className="font-medium text-base text-muted-foreground truncate">{artistName}</p>
        <h3 className="font-medium text-sm leading-tight truncate" title={artwork.title}>
          {truncatedTitle}
        </h3>
        <p className="text-sm text-muted-foreground">
          {year && dimensions ? `${year}, ${dimensions}` : year || dimensions}
        </p>
        <p className="text-xs text-muted-foreground">{artwork.medium_type}</p>
      </div>
      <div className="flex items-center mt-2">
        <div className="flex-1 min-w-0">
          {available && artwork.price ? (
            <ConvertedPrice 
              price={artwork.price} 
              currency={artwork.currency} 
              className="text-sm font-medium block truncate"
            />
          ) : (
            <span className="text-sm text-muted-foreground block">&nbsp;</span>
          )}
        </div>
        <div className="flex-shrink-0 pl-2">
          {available ? (
            <Check className="h-5 w-5 text-green-600" aria-label="Available" />
          ) : (
            <X className="h-5 w-5 text-destructive" aria-label="Unavailable" />
          )}
        </div>
      </div>
    </div>
  );
}
