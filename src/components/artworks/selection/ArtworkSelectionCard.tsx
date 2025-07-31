/**
 * Artwork card with selection capability
 */

import React from "react";
import { Check } from "lucide-react";
import { ArtworkCard } from "../ArtworkCard";
import { cn } from "@/lib/utils";
import type { Artwork } from "@/types/artwork";

interface ArtworkSelectionCardProps {
  artwork: Artwork;
  isSelected: boolean;
  isSelectionMode: boolean;
  onToggleSelection: (artworkId: string) => void;
}

export function ArtworkSelectionCard({
  artwork,
  isSelected,
  isSelectionMode,
  onToggleSelection,
}: ArtworkSelectionCardProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (isSelectionMode) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelection(artwork.id);
    }
  };

  return (
    <div 
      className={cn(
        "relative",
        isSelectionMode && "cursor-pointer",
        isSelected && "ring-2 ring-primary ring-offset-2"
      )}
      onClick={handleClick}
    >
      {isSelectionMode && (
        <div className="absolute top-2 right-2 z-10">
          <div
            className={cn(
              "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
              isSelected 
                ? "bg-primary border-primary text-primary-foreground" 
                : "bg-background border-muted-foreground hover:border-primary"
            )}
          >
            {isSelected && <Check className="w-3 h-3" />}
          </div>
        </div>
      )}
      
      <div className={cn(
        "transition-opacity",
        isSelectionMode && !isSelected && "opacity-70 hover:opacity-100"
      )}>
        <ArtworkCard artwork={artwork} disabled={isSelectionMode} />
      </div>
    </div>
  );
}