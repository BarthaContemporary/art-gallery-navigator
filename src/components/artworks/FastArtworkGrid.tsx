import React, { memo } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { ArtworkCard } from "./ArtworkCard";
import { cn } from "@/lib/utils";

interface FastArtworkGridProps {
  artworks: Artwork[];
  className?: string;
}

function FastArtworkGridComponent({ artworks, className }: FastArtworkGridProps) {
  if (artworks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground text-lg">No artworks found</p>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 auto-rows-max">
        {artworks.map((artwork) => (
          <div key={artwork.id} className="w-full">
            <ArtworkCard artwork={artwork} />
          </div>
        ))}
      </div>
    </div>
  );
}

export const FastArtworkGrid = memo(FastArtworkGridComponent);