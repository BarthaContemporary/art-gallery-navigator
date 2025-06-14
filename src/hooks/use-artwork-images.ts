
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ArtworkImage {
  id: string;
  artwork_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
  processed?: boolean;
  thumbnail_url?: string | null;
  medium_url?: string | null;
}

export function useArtworkImages(artworkId: string) {
  const [images, setImages] = useState<ArtworkImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchImages() {
      if (!artworkId) {
        setImages([]);
        setLoading(false);
        return;
      }
      
      console.log("🔄 Fetching images for artwork:", artworkId);
      setLoading(true);
      setError(null);
      
      try {
        const { data, error: fetchError } = await supabase
          .from("artwork_images")
          .select("*")
          .eq("artwork_id", artworkId)
          .order("display_order", { ascending: true });
          
        if (fetchError) {
          console.error("❌ Error fetching artwork images:", fetchError);
          throw fetchError;
        }
        
        console.log("🖼️ Fetched images:", data?.length || 0, "for artwork:", artworkId);
        
        // Handle empty results gracefully
        if (!data || data.length === 0) {
          console.log("📷 No images found for artwork:", artworkId);
          setImages([]);
        } else {
          // Filter out any invalid images
          const validImages = data.filter(img => img.image_url && img.image_url !== 'null');
          console.log("✅ Valid images after filtering:", validImages.length);
          setImages(validImages);
        }
      } catch (err) {
        console.error("❌ Error fetching artwork images:", err);
        setError("Failed to load images");
        setImages([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    }
    
    fetchImages();
    
  }, [artworkId]);

  return { images, loading, error };
}
