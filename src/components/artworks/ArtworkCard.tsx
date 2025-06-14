
import React, { memo, useState } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { useArtworkActions } from "@/hooks/use-artwork-actions";
import { ArtworkCardActions } from "./ArtworkCardActions";
import { OptimizedArtworkImage } from "./OptimizedArtworkImage";

import { ArtworkOverviewDialogHandler } from "./dialogs/ArtworkOverviewDialogHandler";
import { ArtworkEditDialogHandler } from "./dialogs/ArtworkEditDialogHandler";
import { ArtworkDeleteDialogHandler } from "./dialogs/ArtworkDeleteDialogHandler";

interface ArtworkCardProps {
  artwork: Artwork;
}

function ArtworkCardComponent({ artwork }: ArtworkCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const images = artwork.artwork_images || [];
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
    isDeleting
  } = useArtworkActions(artwork);

  // Allow each handler to be used as event handler
  const onEdit = (e: React.MouseEvent) => {
    if (e) e.stopPropagation();
    handleEdit();
  };
  const onDuplicate = (e: React.MouseEvent) => {
    if (e) e.stopPropagation();
    handleDuplicate();
  };
  const onExport = (e: React.MouseEvent) => {
    if (e) e.stopPropagation();
    handleExport();
  };
  const onDelete = () => setIsDeleteDialogOpen(true);

  return (
    <>
      <div 
        className="group relative flex flex-col h-full border rounded-lg bg-card hover:shadow-md transition-all duration-200 overflow-hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ contain: 'layout' }}
      >
        {/* Fixed height image container */}
        <div className="relative w-full h-64 bg-muted/20 overflow-hidden flex-shrink-0">
          <OptimizedArtworkImage
            imageRecord={primaryImage}
            title={artwork.title}
            onClick={handleView}
            className="w-full h-full object-cover"
          />
          {/* Overlay Actions */}
          <div className={`absolute top-2 right-2 transition-opacity duration-200 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}>
            <ArtworkCardActions
              onEdit={onEdit}
              onDuplicate={onDuplicate}
              onExport={onExport}
              onDelete={onDelete}
            />
          </div>
        </div>
        {/* Content - Increased minimum height for better information display */}
        <div className="flex flex-col justify-between p-4 flex-1 min-h-[160px]">
          <div className="space-y-2">
            <h3 className="font-semibold text-lg leading-tight line-clamp-2">
              {artwork.title}
            </h3>
            {artwork.year && (
              <p className="text-sm text-muted-foreground">
                {artwork.year}
              </p>
            )}
            {artwork.medium_type && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {artwork.medium_type}
              </p>
            )}
          </div>
          {/* Reworked flex layout for price & status */}
          <div className="mt-3 pt-3 border-t border-border/50 flex justify-between items-center gap-2">
            {artwork.price && (
              <p className="text-sm font-medium">
                {artwork.currency} {artwork.price.toLocaleString()}
              </p>
            )}
            <p className="text-xs text-muted-foreground capitalize ml-auto text-right">
              {artwork.status}
            </p>
          </div>
        </div>
      </div>
      {/* DIALOGS: Actual components must be rendered so state works */}
      <ArtworkOverviewDialogHandler
        artwork={artwork}
        open={isOverviewDialogOpen}
        onOpenChange={setIsOverviewDialogOpen}
      />
      <ArtworkEditDialogHandler
        artwork={artwork}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
      <ArtworkDeleteDialogHandler
        artwork={artwork}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        isDeleting={isDeleting}
        confirmDelete={async () => { await handleDelete(); }}
      />
    </>
  );
}

export const ArtworkCard = memo(ArtworkCardComponent);
