
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useFixArtworkImages() {
  const [isFixing, setIsFixing] = useState(false);
  const { toast } = useToast();

  const fixArtworkImages = async (artworkId: string) => {
    setIsFixing(true);
    
    try {
      console.log(`Fixing image order and primary status for artwork: ${artworkId}`);
      
      // First, fetch all images for this artwork
      const { data: images, error: fetchError } = await supabase
        .from("artwork_images")
        .select("*")
        .eq("artwork_id", artworkId)
        .order("created_at", { ascending: true });

      if (fetchError) throw fetchError;

      if (!images || images.length === 0) {
        toast({
          title: "No Images Found",
          description: "No images found for this artwork.",
          variant: "destructive",
        });
        return;
      }

      // Fix display order
      const displayOrderUpdates = images.map((image, index) => 
        supabase
          .from("artwork_images")
          .update({ display_order: index })
          .eq("id", image.id)
      );

      await Promise.allSettled(displayOrderUpdates);

      // Fix primary image status - set first image as primary, others as false
      const primaryUpdates = images.map((image, index) => 
        supabase
          .from("artwork_images")
          .update({ is_primary: index === 0 })
          .eq("id", image.id)
      );

      await Promise.allSettled(primaryUpdates);

      // Process images through Cloudinary if they haven't been processed
      const unprocessedImages = images.filter(img => !img.processed || !img.thumbnail_url || !img.medium_url);
      
      for (const image of unprocessedImages) {
        try {
          console.log(`Processing image ${image.id} through Cloudinary`);
          
          const { data: processResult, error: processError } = await supabase.functions.invoke('process-artwork-image-cloudinary', {
            body: { 
              image_url: image.image_url, 
              artwork_image_id: image.id,
              options: {
                quality: 85,
                format: 'webp',
                sharpen: true,
                autoOrient: true
              }
            }
          });

          if (processError) {
            console.error(`Failed to process image ${image.id}:`, processError);
          } else {
            console.log(`Successfully processed image ${image.id}:`, processResult);
          }
        } catch (error) {
          console.error(`Error processing image ${image.id}:`, error);
        }
      }

      console.log(`Successfully fixed ${images.length} images for artwork ${artworkId}`);
      
      toast({
        title: "Images Fixed",
        description: `Successfully fixed display order and primary status for ${images.length} images. ${unprocessedImages.length} images were processed through Cloudinary.`,
      });

    } catch (error: any) {
      console.error("Error fixing artwork images:", error);
      toast({
        title: "Fix Failed",
        description: error.message || "Failed to fix artwork images.",
        variant: "destructive",
      });
    } finally {
      setIsFixing(false);
    }
  };

  return {
    fixArtworkImages,
    isFixing,
  };
}
