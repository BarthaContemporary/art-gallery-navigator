
import React, { useState } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { UnifiedImage } from "@/components/ui/unified-image";
import { ArtworkCardActions } from "./ArtworkCardActions";
import { cn } from "@/lib/utils";

interface ArtworkCardImageProps {
  artwork: Artwork;
  title: string;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDuplicate: (e: React.MouseEvent) => void;
  onExport: (e: React.MouseEvent) => void;
  onDelete: () => void;
}

export function ArtworkCardImage({
  artwork,
  title,
  onClick,
  onEdit,
  onDuplicate,
  onExport,
  onDelete,
}: ArtworkCardImageProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="relative w-full bg-muted/20 overflow-hidden flex-shrink-0"
      style={{ height: "192px" }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <UnifiedImage
        artwork={artwork}
        tier="medium"
        className="w-full h-full cursor-pointer [&>img]:object-cover"
        alt={title}
        priority={false}
        onClick={onClick}
      />
      
      {/* Overlay with actions */}
      <div className={cn(
        "absolute inset-0 transition-opacity duration-200",
        isHovered ? "opacity-100" : "opacity-0"
      )}>
        <div
          className="absolute top-2 right-2 z-20"
          onClick={e => e.stopPropagation()}
        >
          <ArtworkCardActions
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onExport={onExport}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
}
