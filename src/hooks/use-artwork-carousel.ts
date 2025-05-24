import { useState, useCallback, useEffect, useRef } from "react";
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
 * Custom hook to manage the state and logic for an artwork image carousel.
 * Fetches artwork images from Supabase and integrates with Embla Carousel for navigation.
 * Preloads images when the carousel becomes active.
 *
 * @param artworkId The ID of the artwork for which to display images.
 * @param isDialogActive Boolean indicating if the parent dialog/context is active.
 * @returns An object containing carousel state, images, and control functions.
 */
export function useArtworkCarousel(artworkId: string, isDialogActive: boolean) {
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
  const preloadingInitiatedRef = useRef(false);

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
      if (!artworkId) return;
      
      try {
        setLoading(true);
        setError(null);
        preloadingInitiatedRef.current = false;
        
        const { data, error: fetchError } = await supabase
          .from("artwork_images")
          .select("*")
          .eq("artwork_id", artworkId)
          .order("display_order", { ascending: true });
          
        if (fetchError) throw fetchError;
        
        if (!controller.signal.aborted) {
          setImages(data as ArtworkImage[]);
        }
      } catch (err) {
        console.error("Error fetching artwork images:", err);
        if (!controller.signal.aborted) {
          setError("Failed to load images");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }
    
    fetchArtworkImages();
    
    return () => {
      controller.abort();
    };
  }, [artworkId]);
  
  useEffect(() => {
    if (isDialogActive && images.length > 0 && !preloadingInitiatedRef.current) {
      images.forEach((image) => {
        const img = new Image();
        img.src = image.image_url;
      });
      preloadingInitiatedRef.current = true;
    }
    if (!isDialogActive || images.length === 0) {
      preloadingInitiatedRef.current = false;
    }
  }, [images, isDialogActive, artworkId]);
  
  useEffect(() => {
    if (emblaApi && images.length > 0) {
      const timer = setTimeout(() => {
        emblaApi.reInit();
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [images.length, emblaApi]);
  
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
