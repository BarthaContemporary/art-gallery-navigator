import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Clock, Edit, Trash2, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { EditArtistDialog } from "./EditArtistDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const statusIcons = {
  represented: <Check className="h-4 w-4 text-green-500" />,
  "formerly represented": <X className="h-4 w-4 text-red-500" />,
  "not represented": <X className="h-4 w-4 text-red-500" />,
};

export function ArtistCard({ artist }: { artist: any }) {
  const { isAdmin } = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const confirmDelete = async () => {
    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('artists')
        .delete()
        .eq('id', artist.id);

      if (error) throw error;

      toast.success("Artist deleted successfully");
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Error deleting artist:', error);
      toast.error("Failed to delete artist");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCardClick = () => {
    if (isAdmin) {
      setEditDialogOpen(true);
    }
  };

  const preventPropagation = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Card className="group relative w-full">
      {isAdmin && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              size="icon" 
              variant="ghost" 
              className="absolute top-2 right-2 h-8 w-8 bg-white/80 hover:bg-white shadow-sm z-10 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={preventPropagation}
            >
              <Edit className="h-4 w-4" />
              <span className="sr-only">Actions for {artist.full_name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={preventPropagation}>
            <DropdownMenuItem onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleDelete}
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      
      <div 
        className="aspect-[4/3] w-full overflow-hidden cursor-pointer"
        onClick={handleCardClick}
      >
        <img
          src={artist.image_url || "/placeholder.svg"}
          alt={artist.full_name}
          className="h-full w-full object-cover transition-all hover:scale-105"
        />
      </div>
      
      <CardContent 
        className="p-4 cursor-pointer space-y-1"
        onClick={handleCardClick}
      >
        <h3 className="font-medium text-lg leading-tight">{artist.full_name}</h3>
        <p className="text-muted-foreground">
          {artist.nationality}
          {artist.nationality && artist.birth_year ? ", " : ""}
          {artist.birth_year && <span className="font-medium">b. {artist.birth_year}</span>}
        </p>
        
        {artist.email && (
          <p className="text-sm">
            <span className="text-muted-foreground">Email: </span>
            <a
              href={`mailto:${artist.email}`}
              className="underline hover:text-primary transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {artist.email}
            </a>
          </p>
        )}

        {artist.representation_status && (
          <div className="flex items-center mt-2">
            {statusIcons[artist.representation_status.toLowerCase() as keyof typeof statusIcons] || null}
            <span className="text-sm ml-1 capitalize">{artist.representation_status}</span>
          </div>
        )}
      </CardContent>
      
      <EditArtistDialog
        artist={artist}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
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
