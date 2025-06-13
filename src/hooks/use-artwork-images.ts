
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
  const [cacheKey, setCacheKey] = useState(0);

  useEffect(() => {
    async function fetchImages() {
      if (!artworkId) return;
      
      console.log("🔄 Fetching images for artwork:", artworkId, "cache key:", cacheKey);
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
    
    // Force cache refresh every 5 seconds for debugging
    const interval = setInterval(() => {
      setCacheKey(prev => prev + 1);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [artworkId, cacheKey]);

  return { images, loading, error };
}
