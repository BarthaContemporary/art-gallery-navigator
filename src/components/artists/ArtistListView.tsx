
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Mail, MapPin, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { EditArtistDialog } from "@/components/artists/EditArtistDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OptimizedArtistImage } from "@/components/artists/OptimizedArtistImage";
import { useGmailCompose } from "@/hooks/use-gmail-compose";

interface Artist {
  id: string;
  full_name: string;
  surname_first_letter?: string | null;
  birth_year: number | null;
  death_year?: number | null;
  place_of_birth?: string | null;
  place_of_death?: string | null;
  nationality: string | null;
  representation_status: string;
  biography: string | null;
  image_url: string | null;
  email?: string | null;
}

interface ArtistListViewProps {
  artists: Artist[];
}

export function ArtistListView({ artists }: ArtistListViewProps) {
  const { isAdmin } = useAuth();
  const { composeEmail, isLoading } = useGmailCompose();
  const [editingArtist, setEditingArtist] = useState<Artist | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleEdit = (artist: Artist) => {
    setEditingArtist(artist);
    setEditDialogOpen(true);
  };

  const handleDelete = async (artistId: string) => {
    if (!confirm('Are you sure you want to delete this artist?')) return;
    
    try {
      const { error } = await supabase
        .from('artists')
        .delete()
        .eq('id', artistId);
      
      if (error) throw error;
      toast.success('Artist deleted successfully');
    } catch (error) {
      console.error('Error deleting artist:', error);
      toast.error('Failed to delete artist');
    }
  };

  const handleEmailClick = async (artist: Artist) => {
    if (artist.email) {
      await composeEmail({
        to: artist.email,
        subject: `Gallery Correspondence - ${artist.full_name}`,
        body: `Dear ${artist.full_name},\n\nI hope this email finds you well.\n\nBest regards`
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'represented':
        return 'bg-green-100 text-green-800';
      case 'formerly represented':
        return 'bg-yellow-100 text-yellow-800';
      case 'not represented':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-3">
      {artists.map((artist) => (
        <Card key={artist.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {/* Artist Image */}
              <div className="flex-shrink-0">
                <OptimizedArtistImage
                  imageUrl={artist.image_url}
                  artistName={artist.full_name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
              </div>

              {/* Artist Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg truncate">{artist.full_name}</h3>
                    
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                      {artist.nationality && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>{artist.nationality}</span>
                        </div>
                      )}
                      
                      {artist.birth_year && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {artist.birth_year}
                            {artist.death_year && ` - ${artist.death_year}`}
                          </span>
                        </div>
                      )}
                      
                      {artist.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEmailClick(artist)}
                            disabled={isLoading}
                            className="h-auto p-0 text-primary hover:underline"
                          >
                            {artist.email}
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="mt-2">
                      <Badge className={getStatusColor(artist.representation_status)}>
                        {artist.representation_status}
                      </Badge>
                    </div>
                  </div>

                  {/* Admin Actions */}
                  {isAdmin && (
                    <div className="flex items-center gap-1 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(artist)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(artist.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {editingArtist && (
        <EditArtistDialog
          artist={editingArtist}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditingArtist(null);
          }}
        />
      )}
    </div>
  );
}
