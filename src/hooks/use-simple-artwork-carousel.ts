
import { useState, useCallback, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface SimpleArtworkImage {
  id: string;
  artwork_id: string;
  image_url: string;
  thumbnail_url?: string | null;
  medium_url?: string | null;
  is_primary: boolean;
  display_order: number;
  processed?: boolean;
}

export function useSimpleArtworkCarousel(artworkId: string) {
  const [images, setImages] = useState<SimpleArtworkImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false,
    align: "center",
  });

  // Fetch images
  useEffect(() => {
    async function fetchImages() {
      if (!artworkId) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        logger.log(`[SimpleCarousel] Fetching images for artwork: ${artworkId}`);
        
        const { data, error: fetchError } = await supabase
          .from("artwork_images")
          .select("*")
          .eq("artwork_id", artworkId)
          .order("display_order", { ascending: true });
          
        if (fetchError) throw fetchError;
        
        // Sort: primary first, then by display order
        const sortedImages = (data || []).sort((a, b) => {
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
          return a.display_order - b.display_order;
        });
        
        logger.log(`[SimpleCarousel] Loaded ${sortedImages.length} images`);
        setImages(sortedImages as SimpleArtworkImage[]);
      } catch (err) {
        logger.error("[SimpleCarousel] Error fetching images:", err);
        setError("Failed to load images");
      } finally {
        setLoading(false);
      }
    }
    
    fetchImages();
  }, [artworkId]);

  // Handle carousel selection
  useEffect(() => {
    if (!emblaApi || loading) return;

    const onSelect = () => {
      const newIndex = emblaApi.selectedScrollSnap();
      setCurrentIndex(newIndex);
    };

    emblaApi.on("select", onSelect);
    onSelect(); // Set initial index

    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, loading]);

  // Navigation functions
  const scrollTo = useCallback((index: number) => {
    if (!emblaApi) return;
    emblaApi.scrollTo(index);
  }, [emblaApi]);

  const scrollPrev = useCallback(() => {
    if (!emblaApi) return;
    emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (!emblaApi) return;
    emblaApi.scrollNext();
  }, [emblaApi]);

  const canScrollPrev = emblaApi?.canScrollPrev() ?? false;
  const canScrollNext = emblaApi?.canScrollNext() ?? false;
  const hasMultipleImages = images.length > 1;

  return {
    images,
    currentIndex,
    loading,
    error,
    emblaRef,
    hasMultipleImages,
    scrollTo,
    scrollPrev,
    scrollNext,
    canScrollPrev,
    canScrollNext,
  };
}
