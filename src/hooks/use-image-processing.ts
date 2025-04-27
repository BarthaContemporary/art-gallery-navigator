
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useImageProcessing() {
  const processImage = useCallback(async (imageUrl: string, artworkImageId: string) => {
    try {
      const { error } = await supabase.functions.invoke('process-artwork-image', {
        body: { image_url: imageUrl, artwork_image_id: artworkImageId }
      });

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error('Failed to process image');
      return false;
    }
  }, []);

  return { processImage };
}
