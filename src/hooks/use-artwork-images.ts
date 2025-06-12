
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ArtworkImage {
  id: string;
  artwork_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
}

export function useArtworkImages(artworkId: string) {
  const [images, setImages] = useState<ArtworkImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchImages() {
      if (!artworkId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const { data, error: fetchError } = await supabase
          .from("artwork_images")
          .select("*")
          .eq("artwork_id", artworkId)
          .order("display_order", { ascending: true });
          
        if (fetchError) throw fetchError;
        
        setImages(data || []);
      } catch (err) {
        console.error("Error fetching artwork images:", err);
        setError("Failed to load images");
      } finally {
        setLoading(false);
      }
    }
    
    fetchImages();
  }, [artworkId]);

  return { images, loading, error };
}
