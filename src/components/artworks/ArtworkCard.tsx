
import { Check, Clock, DollarSign, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Artwork } from "@/hooks/use-artworks";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { EditArtworkDialog } from "./EditArtworkDialog";
import { ArtworkOverviewDialog } from "./ArtworkOverviewDialog";
import { exportArtworksToCSV } from "@/lib/csv";
import { useArtists } from "@/hooks/useArtists";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArtworkCardActions } from "./ArtworkCardActions";
import { OptimizedArtworkImage } from "./OptimizedArtworkImage";
import { useArtworkActions } from "@/hooks/use-artwork-actions";

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

export function ArtworkCard({ artwork }: ArtworkCardProps) {
  const { isAdmin } = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [overviewDialogOpen, setOverviewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { data: artists } = useArtists();
  const { isDeleting, handleDelete, handleDuplicate } = useArtworkActions(artwork);

  const handleEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditDialogOpen(true);
  };

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    exportArtworksToCSV([artwork], `artwork_${artwork.id}.csv`);
  };

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
    if (art.height) parts.push(`H ${art.height}`);
    if (art.width) parts.push(`W ${art.width}`);
    if (art.depth) parts.push(`D ${art.depth}`);
    return parts.length > 0 ? parts.join(' ') : "N/A";
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

  return (
    <>
      <Card className="group relative flex flex-col h-full border-gray-200"> {/* Removed hover:shadow-md */}
        {isAdmin && (
          <ArtworkCardActions
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onExport={handleExport}
            onDelete={() => setDeleteDialogOpen(true)}
          />
        )}
        
        <OptimizedArtworkImage
          imageUrl={artwork.image_url}
          title={artwork.title}
          onClick={() => setOverviewDialogOpen(true)}
        />
        
        <CardContent 
          className="p-4 cursor-pointer space-y-1 flex-grow"
          onClick={() => setOverviewDialogOpen(true)}
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
        
        <EditArtworkDialog
          artwork={artwork}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
        />
        
        <ArtworkOverviewDialog
          artwork={artwork}
          open={overviewDialogOpen}
          onOpenChange={setOverviewDialogOpen}
        />
      </Card>
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the artwork
              "{artwork.title}" and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
