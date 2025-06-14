
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
  // Removed cacheKey state

  useEffect(() => {
    async function fetchImages() {
      if (!artworkId) return;
      
      console.log("🔄 Fetching images for artwork:", artworkId); // Removed cache key from log
      setLoading(true);
      setError(null);
      
      try {
        const { data, error: fetchError } = await supabase
          .from("artwork_images")
          .select("*")
          .eq("artwork_id", artworkId)
          .order("display_order", { ascending: true });
          
        if (fetchError) throw fetchError;
        
        console.log("🖼️ Fetched images:", data?.length || 0);
        setImages(data || []);
      } catch (err) {
        console.error("❌ Error fetching artwork images:", err);
        setError("Failed to load images");
      } finally {
        setLoading(false);
      }
    }
    
    fetchImages();
    
    // Removed debug interval and clearInterval
  }, [artworkId]); // Removed cacheKey from dependencies

  return { images, loading, error };
}

