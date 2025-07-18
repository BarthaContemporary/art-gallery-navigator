import React from "react";
import { Artwork } from "@/hooks/use-artworks";
import { SimpleArtworkCard } from "./SimpleArtworkCard";

interface SimpleArtworkGridProps {
  artworks: Artwork[];
}

export function SimpleArtworkGrid({ artworks }: SimpleArtworkGridProps) {
  if (artworks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground text-lg">No artworks found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
      {artworks.map((artwork) => (
        <SimpleArtworkCard key={artwork.id} artwork={artwork} />
      ))}
    </div>
  );
}