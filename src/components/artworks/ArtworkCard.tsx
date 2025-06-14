import React, { memo, useState, useCallback } from "react";
import { Check, Clock, DollarSign, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Artwork } from "@/hooks/use-artworks";
import { useAuth } from "@/hooks/use-auth";
import { useArtists } from "@/hooks/useArtists";
import { ArtworkCardActions } from "./ArtworkCardActions";
import { OptimizedArtworkImage } from "./OptimizedArtworkImage";
import { useArtworkActions } from "@/hooks/use-artwork-actions";
import { exportArtworksToCSV } from "@/lib/csv";
import { ArtworkEditDialogHandler } from "./dialogs/ArtworkEditDialogHandler";
import { ArtworkOverviewDialogHandler } from "./dialogs/ArtworkOverviewDialogHandler";
import { ArtworkDeleteDialogHandler } from "./dialogs/ArtworkDeleteDialogHandler";
import type { ArtworkImage } from "@/hooks/use-artwork-images";

interface ArtworkCardProps {
  artwork: Artwork;
}

const statusIcons = {
  available: <Check className="h-4 w-4 text-green-500" />,
  "on hold": <Clock className="h-4 w-4 text-amber-500" />,
  sold: <DollarSign className="h-4 w-4 text-blue-500" />,
  consigned: <Briefcase className="h-4 w-4 text-purple-500" />,
  "not for sale": <Check className="h-4 w-4 text-gray-500" />,
};

function ArtworkCardComponent({ artwork }: ArtworkCardProps) {
  const { isAdmin } = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [overviewDialogOpen, setOverviewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { data: artists } = useArtists();
  const { isDeleting, handleDelete, handleDuplicate } = useArtworkActions(artwork);

  const handleEdit = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setEditDialogOpen(true);
  }, []);

  const handleExport = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    exportArtworksToCSV([artwork], `artwork_${artwork.id}.csv`);
  }, [artwork]);

  const openOverviewDialog = useCallback(() => {
    setOverviewDialogOpen(true);
  }, []);

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-artwork-action]')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    openOverviewDialog();
  }, [openOverviewDialog]);

  const handleDeleteClick = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setDeleteDialogOpen(true);
  }, []);

  const handleDuplicateClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleDuplicate();
  }, [handleDuplicate]);
  
  const getArtistName = () => {
    if (artwork.artist_id && artists) {
      const artist = artists.find(a => a.id === artwork.artist_id);
      return artist ? artist.full_name : "Unknown Artist";
    }
    return "Unknown Artist";
  };

  const confirmDelete = async () => {
    const success = await handleDelete();
    if (success) {
      setDeleteDialogOpen(false);
    }
  };

  const formatDimensions = (art: Artwork) => {
    const parts = [];
    if (art.height) parts.push(art.height);
    if (art.width) parts.push(art.width);
    if (art.depth) parts.push(art.depth);
    return parts.length > 0 ? parts.join(' x ') + ' cm' : "N/A";
  };
  
  const formatEditionInfo = (art: Artwork) => {
    if (art.classification === 'Unique') {
      return null;
    }
    const parts = [];
    if (art.edition_size) parts.push(`Ed. Size: ${art.edition_size}`);
    if (art.available_works) parts.push(`Avail.: ${art.available_works}`);
    return parts.join(' / ');
  };

  // Prepare imageRecord for OptimizedArtworkImage
  // Use artwork.artwork_images (fetched from Supabase)
  const primaryImage = artwork.artwork_images?.find(img => img.is_primary) || artwork.artwork_images?.[0];
  const imageRecordToPass: ArtworkImage | undefined = primaryImage 
    ? primaryImage 
    : (artwork.image_url // Fallback to main image_url if no processed images array
        ? {
            id: artwork.id + '_primary_fallback', // Construct a stable ID for caching
            artwork_id: artwork.id,
            image_url: artwork.image_url, // Original Supabase URL
            is_primary: true,
            display_order: 0,
            thumbnail_url: null, 
            medium_url: null,
            processed: false, // Indicate it's a fallback, not fully processed record
          }
        : undefined);

  return (
    <>
      <Card 
        className="group relative flex flex-col h-full border-gray-200 transition-transform duration-200 hover:scale-[1.02] will-change-transform"
        style={{ 
          contain: 'layout style',
          willChange: 'transform'
        }}
      >
        {isAdmin && (
          <div data-artwork-action="true">
            <ArtworkCardActions
              onEdit={handleEdit}
              onDuplicate={handleDuplicateClick}
              onExport={handleExport}
              onDelete={handleDeleteClick}
            />
          </div>
        )}
        
        <OptimizedArtworkImage
          imageRecord={imageRecordToPass}
          title={artwork.title || "Untitled Artwork"}
          onClick={openOverviewDialog}
        />
        
        <CardContent 
          className="p-4 cursor-pointer space-y-1 flex-grow"
          onClick={handleCardClick}
        >
          <p className="text-muted-foreground text-sm">{getArtistName()}</p>
          <h3 className="font-semibold text-base leading-tight min-h-[2.5rem]">{artwork.title}{artwork.year ? `, ${artwork.year}` : ''}</h3>
          
          {artwork.materials && <p className="text-xs text-gray-600 truncate">{artwork.materials}</p>}
          
          {formatEditionInfo(artwork) && (
            <p className="text-xs text-gray-600">{formatEditionInfo(artwork)}</p>
          )}
          
          <p className="text-xs text-gray-600">
            {formatDimensions(artwork)}
          </p>

          <p className="text-xs text-gray-600">{artwork.medium_type}</p>
          
          <div className="flex justify-between items-center pt-2">
            {artwork.price && (
              <p className="font-medium text-sm">
                {artwork.currency} {artwork.price.toLocaleString()}
              </p>
            )}
            {!artwork.price && artwork.status && statusIcons[artwork.status as keyof typeof statusIcons] && <div />} 
            
            {artwork.status && statusIcons[artwork.status as keyof typeof statusIcons] && (
              <div className="flex items-center">
                {statusIcons[artwork.status as keyof typeof statusIcons]}
                <span className="text-xs ml-1 capitalize">{artwork.status}</span>
              </div>
            )}
          </div>
        </CardContent>
        
        <ArtworkEditDialogHandler
          artwork={artwork}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
        />
        
        <ArtworkOverviewDialogHandler
          artwork={artwork}
          open={overviewDialogOpen}
          onOpenChange={setOverviewDialogOpen}
        />
      </Card>
      
      <ArtworkDeleteDialogHandler
        artwork={artwork}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        isDeleting={isDeleting}
        confirmDelete={confirmDelete}
      />
    </>
  );
}

export const ArtworkCard = memo(ArtworkCardComponent);
