
import { useState, useCallback, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { supabase } from "@/integrations/supabase/client";

interface ArtworkImage {
  id: string;
  artwork_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
}

/**
 * Simplified custom hook to manage the state and logic for an artwork image carousel.
 * Fetches artwork images from Supabase and integrates with Embla Carousel for navigation.
 *
 * @param artworkId The ID of the artwork for which to display images.
 * @returns An object containing carousel state, images, and control functions.
 */
export function useArtworkCarousel(artworkId: string) {
  const [images, setImages] = useState<ArtworkImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: true,
    align: "start",
    slidesToScroll: 1,
    containScroll: "trimSnaps",
    watchDrag: false, 
    skipSnaps: false 
  });

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCurrentIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    
    onSelect();
    emblaApi.on("select", onSelect);
    
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    const controller = new AbortController();
    
    async function fetchArtworkImages() {
      if (!artworkId) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        const { data, error: fetchError } = await supabase
          .from("artwork_images")
          .select("*")
          .eq("artwork_id", artworkId)
          .order("display_order", { ascending: true });
          
        if (fetchError) throw fetchError;
        
        if (!controller.signal.aborted) {
          setImages(data as ArtworkImage[]);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching artwork images:", err);
        if (!controller.signal.aborted) {
          setError("Failed to load images");
          setLoading(false);
        }
      }
    }
    
    fetchArtworkImages();
    
    return () => {
      controller.abort();
    };
  }, [artworkId]);
  
  const handleDotClick = useCallback((index: number) => {
    if (emblaApi) {
      emblaApi.scrollTo(index);
    }
  }, [emblaApi]);

  const scrollPrev = useCallback(() => {
    emblaApi?.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    emblaApi?.scrollNext();
  }, [emblaApi]);

  return {
    images,
    currentIndex,
    loading,
    error,
    emblaRef,
    emblaApi,
    handleDotClick,
    scrollPrev,
    scrollNext,
  };
}

export type { ArtworkImage };
