
import { useState, useCallback, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { supabase } from "@/integrations/supabase/client";
import type { ArtworkImage } from "@/hooks/use-artworks";
import { logger } from "@/lib/logger";

export function useCloudinaryCarousel(artworkId: string) {
  const [images, setImages] = useState<ArtworkImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false,
    align: "start",
    slidesToScroll: 1,
  });

  // Fetch artwork images
  useEffect(() => {
    async function fetchImages() {
      if (!artworkId) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        logger.log(`[Cloudinary Carousel] Fetching images for artwork: ${artworkId}`);
        
        const { data, error: fetchError } = await supabase
          .from("artwork_images")
          .select("*")
          .eq("artwork_id", artworkId)
          .order("display_order", { ascending: true });
          
        if (fetchError) throw fetchError;
        
        const sortedImages = (data || []).sort((a, b) => {
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
          return a.display_order - b.display_order;
        });
        
        logger.log(`[Cloudinary Carousel] Loaded ${sortedImages.length} images`);
        setImages(sortedImages as ArtworkImage[]);
        setCurrentIndex(0);
      } catch (err) {
        logger.error("[Cloudinary Carousel] Error fetching images:", err);
        setError("Failed to load images");
      } finally {
        setLoading(false);
      }
    }
    
    fetchImages();
  }, [artworkId]);

  // Handle carousel events
  useEffect(() => {
    if (!emblaApi || images.length === 0) return;

    const onSelect = () => {
      const newIndex = emblaApi.selectedScrollSnap();
      setCurrentIndex(newIndex);
    };

    emblaApi.reInit();
    onSelect();
    emblaApi.on("select", onSelect);

    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, images]);

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
    emblaApi,
    hasMultipleImages,
    scrollTo,
    scrollPrev,
    scrollNext,
    canScrollPrev,
    canScrollNext,
  };
}
