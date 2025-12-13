import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Edit, Trash2, X, Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { EditArtistDialog } from "./EditArtistDialog";
import { ArtistInfoPanel } from "./ArtistInfoPanel";
import { OptimizedArtistImage } from "./OptimizedArtistImage";
import { useGmailCompose } from "@/hooks/use-gmail-compose";
import { useQueryClient } from "@tanstack/react-query";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

const statusIcons = {
  represented: <Check className="h-4 w-4 text-green-500" />,
  "formerly represented": <X className="h-4 w-4 text-red-500" />,
  "not represented": <X className="h-4 w-4 text-red-500" />,
};

export function ArtistCard({ artist }: { artist: any }) {
  const { isAdmin } = useAuth();
  const { composeEmail, isLoading } = useGmailCompose();
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleEdit = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setEditDialogOpen(true);
  };

  const handleDelete = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleEmailClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (artist.email) {
      await composeEmail({
        to: artist.email,
        subject: `Gallery Correspondence - ${artist.full_name}`,
        body: `Dear ${artist.full_name},\n\nI hope this email finds you well.\n\nBest regards`
      });
    }
  };

  const confirmDelete = async () => {
    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('artists')
        .delete()
        .eq('id', artist.id);

      if (error) throw error;

      toast.success("Artist deleted successfully");
      queryClient.invalidateQueries({ queryKey: ['artists'] });
      setShowDeleteConfirm(false);
    } catch (error) {
      logger.error('Error deleting artist:', error);
      toast.error("Failed to delete artist");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImageClick = () => {
    setInfoPanelOpen(true);
  };

  const handleCardContentClick = () => {
    if (isAdmin) {
      setEditDialogOpen(true);
    } else {
      setInfoPanelOpen(true);
    }
  };

  return (
    <Card 
      className="group relative w-full" 
      style={{ isolation: 'isolate' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Edit/Delete buttons - only visible on hover */}
      {isAdmin && (
        <div 
          className={`absolute top-2 right-2 z-10 flex gap-1 transition-opacity duration-200 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-7 w-7 sm:h-8 sm:w-8 bg-white/90 hover:bg-white shadow-sm"
            onClick={handleEdit}
          >
            <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="sr-only">Edit {artist.full_name}</span>
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-7 w-7 sm:h-8 sm:w-8 bg-white/90 hover:bg-red-50 shadow-sm text-muted-foreground hover:text-red-600"
            onClick={handleDelete}
          >
            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="sr-only">Delete {artist.full_name}</span>
          </Button>
        </div>
      )}
      
      <OptimizedArtistImage
        imageUrl={artist.image_url}
        artistName={artist.full_name}
        onClick={handleImageClick}
      />
      
      <CardContent 
        className="p-3 sm:p-4 cursor-pointer space-y-1"
        onClick={handleCardContentClick}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-sm sm:text-lg leading-tight line-clamp-2">{artist.full_name}</h3>
          {artist.email && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEmailClick}
              disabled={isLoading}
              className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0 h-6 w-6 p-0"
              title={`Email ${artist.full_name}`}
            >
              <Mail className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          )}
        </div>
        
        <p className="text-muted-foreground text-xs sm:text-sm">
          {artist.nationality}
          {artist.nationality && (artist.birth_year || artist.death_year) ? ", " : ""}
          {artist.birth_year && <span className="font-medium">b. {artist.birth_year}</span>}
          {artist.birth_year && artist.death_year ? ", " : ""}
          {artist.death_year && <span className="font-medium">d. {artist.death_year}</span>}
        </p>

        {artist.representation_status && (
          <div className="flex items-center mt-2">
            {statusIcons[artist.representation_status.toLowerCase() as keyof typeof statusIcons] || null}
            <span className="text-xs sm:text-sm ml-1 capitalize">{artist.representation_status}</span>
          </div>
        )}
      </CardContent>
      
      <EditArtistDialog
        artist={artist}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      <ArtistInfoPanel
        artist={artist}
        open={infoPanelOpen}
        onOpenChange={setInfoPanelOpen}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the artist "{artist.full_name}" and remove all associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Artist"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
