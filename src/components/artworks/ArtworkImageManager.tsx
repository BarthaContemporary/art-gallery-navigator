
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Image as ImageIcon, Star } from "lucide-react";
import { useArtwork } from "@/hooks/use-artworks";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { OptimizedArtworkImage } from "./OptimizedArtworkImage";

interface ArtworkImageManagerProps {
  artworkId: string;
}

export function ArtworkImageManager({ artworkId }: ArtworkImageManagerProps) {
  const { data: artwork, isLoading: loading } = useArtwork(artworkId);
  const images = artwork?.artwork_images || [];
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);

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
      queryClient.invalidateQueries({ queryKey: ['artworks', artworkId] });
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

  const handleSetPrimaryImage = async (imageId: string) => {
    setSettingPrimary(imageId);
    try {
      // Set all other images to is_primary: false, this id to true
      // 1. Set all to false
      const { error: updateErrorAll } = await supabase
        .from("artwork_images")
        .update({ is_primary: false })
        .eq("artwork_id", artworkId);
      if (updateErrorAll) throw updateErrorAll;
      // 2. Set selected to true
      const { error: updateError } = await supabase
        .from("artwork_images")
        .update({ is_primary: true })
        .eq("id", imageId);
      if (updateError) throw updateError;

      toast({
        title: "Primary Image Changed",
        description: "The primary image was updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['artwork-images', artworkId] });
      queryClient.invalidateQueries({ queryKey: ['artworks', artworkId] });
      queryClient.invalidateQueries({ queryKey: ['artworks'] });
    } catch (error) {
      toast({
        title: "Failed to update primary image",
        description: "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setSettingPrimary(null);
    }
  };

  if (loading && !artwork) {
    return (
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">Loading images...</div>
      </div>
    );
  }

  if (!images.length) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
          No images attached to this artwork
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {images.map((image, index) => (
          <div key={image.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="relative w-12 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                <OptimizedArtworkImage
                  imageRecord={image}
                  title={`Image ${index + 1}`}
                  tier="thumbnail"
                  className="w-full h-full"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  {image.is_primary && (
                    <span className="inline-block bg-primary/10 text-primary px-2 py-1 rounded text-xs mr-2">
                      Primary
                    </span>
                  )}
                  Image {index + 1}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {images.length > 1 && (
                <Button
                  variant={image.is_primary ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handleSetPrimaryImage(image.id)}
                  disabled={settingPrimary === image.id}
                  className={`h-8 w-8 p-0 ${image.is_primary ? "text-primary" : "text-muted-foreground"}`}
                  title={image.is_primary ? "Already Primary" : "Set as Primary Image"}
                >
                  <Star className={`h-4 w-4 ${image.is_primary ? "fill-primary" : ""}`} />
                </Button>
              )}
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
          </div>
        ))}
      </div>
    </div>
  );
}
