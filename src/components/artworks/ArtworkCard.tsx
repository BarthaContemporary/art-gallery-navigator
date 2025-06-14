
import React, { memo, useState } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { useArtworkActions } from "@/hooks/use-artwork-actions";
import { ArtworkCardActions } from "./ArtworkCardActions";
import { OptimizedArtworkImage } from "./OptimizedArtworkImage";
import { useArtworkImages } from "@/hooks/use-artwork-images";

interface ArtworkCardProps {
  artwork: Artwork;
}

function ArtworkCardComponent({ artwork }: ArtworkCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { images } = useArtworkImages(artwork.id);
  const primaryImage = images.find(img => img.is_primary) || images[0];
  
  const {
    handleView,
    handleEdit,
    handleDelete,
    handleDuplicate,
    handleExport,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    isOverviewDialogOpen,
    setIsOverviewDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
  } = useArtworkActions(artwork);

  return (
    <div 
      className="group relative flex flex-col h-full border rounded-lg bg-card hover:shadow-md transition-all duration-200 overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ contain: 'layout' }} // Prevent layout shifts
    >
      {/* Fixed height image container to prevent shifts */}
      <div className="relative w-full h-64 bg-muted/20 overflow-hidden flex-shrink-0">
        <OptimizedArtworkImage
          imageRecord={primaryImage}
          title={artwork.title}
          onClick={handleView}
          className="w-full h-full object-cover"
        />
        
        {/* Action buttons overlay - positioned absolutely to not affect layout */}
        <div className={`absolute top-2 right-2 transition-opacity duration-200 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}>
          <ArtworkCardActions
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onExport={handleExport}
            onDelete={handleDelete}
          />
        </div>
      </div>

      {/* Fixed height content area */}
      <div className="flex flex-col justify-between p-4 flex-1 min-h-[120px]">
        <div className="space-y-1">
          <h3 className="font-semibold text-lg leading-tight line-clamp-2">
            {artwork.title}
          </h3>
          {artwork.year && (
            <p className="text-sm text-muted-foreground">
              {artwork.year}
            </p>
          )}
          {artwork.medium_type && (
            <p className="text-xs text-muted-foreground">
              {artwork.medium_type}
            </p>
          )}
        </div>
        
        <div className="mt-2 pt-2 border-t border-border/50">
          {artwork.price && (
            <p className="text-sm font-medium">
              {artwork.currency} {artwork.price.toLocaleString()}
            </p>
          )}
          <p className="text-xs text-muted-foreground capitalize">
            {artwork.status}
          </p>
        </div>
      </div>

      {/* Dialogs - these don't affect layout as they're portaled */}
      
    </div>
  );
}

export const ArtworkCard = memo(ArtworkCardComponent);
