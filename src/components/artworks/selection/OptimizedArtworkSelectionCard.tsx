/**
 * Optimized Selection Card - Renders selection UI without wrapping the entire card
 */

import React, { memo, useCallback } from "react";
import { Check } from "lucide-react";
import { OptimizedArtworkCard } from "../OptimizedArtworkCard";
import { cn } from "@/lib/utils";
import type { Artwork } from "@/types/artwork";

interface OptimizedArtworkSelectionCardProps {
  artwork: Artwork;
  isSelected: boolean;
  isSelectionMode: boolean;
  onToggleSelection: (artworkId: string) => void;
  index?: number;
}

const OptimizedArtworkSelectionCardComponent = ({
  artwork,
  isSelected,
  isSelectionMode,
  onToggleSelection,
  index = 0,
}: OptimizedArtworkSelectionCardProps) => {
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isSelectionMode) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelection(artwork.id);
    }
  }, [isSelectionMode, onToggleSelection, artwork.id]);

  if (!isSelectionMode) {
    return <OptimizedArtworkCard artwork={artwork} index={index} />;
  }

  return (
    <div 
      className={cn(
        "relative cursor-pointer",
        isSelected && "ring-2 ring-primary ring-offset-2"
      )}
      onClick={handleClick}
    >
      {/* Selection indicator overlay */}
      <div className="absolute top-2 left-2 z-10">
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
      
      {/* Card with opacity effect */}
      <div className={cn(
        "transition-opacity",
        !isSelected && "opacity-70 hover:opacity-100"
      )}>
        <OptimizedArtworkCard artwork={artwork} disabled={true} index={index} />
      </div>
    </div>
  );
};

// Optimize memo comparison
const arePropsEqual = (
  prevProps: OptimizedArtworkSelectionCardProps,
  nextProps: OptimizedArtworkSelectionCardProps
) => {
  return (
    prevProps.artwork.id === nextProps.artwork.id &&
    prevProps.artwork.updated_at === nextProps.artwork.updated_at &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isSelectionMode === nextProps.isSelectionMode &&
    prevProps.index === nextProps.index
  );
};

export const OptimizedArtworkSelectionCard = memo(OptimizedArtworkSelectionCardComponent, arePropsEqual);