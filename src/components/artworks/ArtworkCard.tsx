
import { Check, Clock, DollarSign, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Artwork } from "@/hooks/use-artworks";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { EditArtworkDialog } from "./EditArtworkDialog";
import { ArtworkOverviewDialog } from "./ArtworkOverviewDialog";
import { exportArtworksToCSV } from "@/lib/csv-utils";
import { useArtists } from "./form/useArtists";
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
import { ArtworkCardImage } from "./ArtworkCardImage";
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

  return (
    <>
      <Card className="group relative">
        {isAdmin && (
          <ArtworkCardActions
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onExport={handleExport}
            onDelete={() => setDeleteDialogOpen(true)}
          />
        )}
        
        <ArtworkCardImage
          imageUrl={artwork.image_url}
          title={artwork.title}
          onClick={() => setOverviewDialogOpen(true)}
        />
        
        <CardContent 
          className="p-4 cursor-pointer space-y-1"
          onClick={() => setOverviewDialogOpen(true)}
        >
          <h3 className="font-medium text-lg leading-tight">{artwork.title}</h3>
          <p className="text-muted-foreground">{getArtistName()}</p>
          <p className="text-sm">{artwork.medium_type}</p>
          {artwork.price && (
            <p className="font-medium">
              {artwork.currency} {artwork.price.toLocaleString()}
            </p>
          )}
          {artwork.status && statusIcons[artwork.status as keyof typeof statusIcons] && (
            <div className="flex items-center">
              {statusIcons[artwork.status as keyof typeof statusIcons]}
              <span className="text-sm ml-1 capitalize">{artwork.status}</span>
            </div>
          )}
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
