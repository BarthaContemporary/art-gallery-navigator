
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Image as ImageIcon } from "lucide-react";
import { useArtworkImages } from "@/hooks/use-artwork-images";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ArtworkImageManagerProps {
  artworkId: string;
}

export function ArtworkImageManager({ artworkId }: ArtworkImageManagerProps) {
  const { images, loading } = useArtworkImages(artworkId);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);

  const handleDeleteImage = async (imageId: string, imageUrl: string) => {
    setDeletingImageId(imageId);
    
    try {
      const { error: dbError } = await supabase
        .from('artwork_images')
        .delete()
        .eq('id', imageId);

      if (dbError) throw dbError;

      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      
      const { error: storageError } = await supabase.storage
        .from('artwork-images')
        .remove([fileName]);

      if (storageError) {
        console.warn('Storage deletion failed:', storageError);
      }

      toast({
        title: "Success",
        description: "Image deleted successfully",
      });

      queryClient.invalidateQueries({ queryKey: ['artwork-images', artworkId] });
      queryClient.invalidateQueries({ queryKey: ['artworks'] });
      
    } catch (error) {
      console.error('Error deleting image:', error);
      toast({
        title: "Error",
        description: "Failed to delete image",
        variant: "destructive",
      });
    } finally {
      setDeletingImageId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Attached Images</h4>
        <div className="text-sm text-muted-foreground">Loading images...</div>
      </div>
    );
  }

  if (!images.length) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Attached Images</h4>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
          No images attached
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Attached Images ({images.length})</h4>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {images.map((image) => (
          <div key={image.id} className="flex items-center justify-between p-2 border rounded-lg">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="relative w-12 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                <img 
                  src={image.image_url} 
                  alt="Artwork" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-gray-400" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground truncate">
                  {image.is_primary && (
                    <span className="inline-block bg-primary/10 text-primary px-1 py-0.5 rounded text-xs mr-1">
                      Primary
                    </span>
                  )}
                  Order: {image.display_order + 1}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteImage(image.id, image.image_url)}
              disabled={deletingImageId === image.id}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
