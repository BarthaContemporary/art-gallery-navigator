
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
    watchDrag: false, // Reduce unnecessary reloads during drag
    skipSnaps: false // Make navigation smoother
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
      if (!artworkId) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const { data, error } = await supabase
          .from("artwork_images")
          .select("*")
          .eq("artwork_id", artworkId)
          .order("display_order", { ascending: true });
          
        if (error) throw error;
        
        // Only update state if the component is still mounted
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
  
  // This effect is separate to avoid resetting the carousel when it's not needed
  useEffect(() => {
    if (emblaApi && images.length > 0) {
      // Use setTimeout to allow the DOM to update before reinitializing
      const timer = setTimeout(() => {
        emblaApi.reInit();
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [images.length, emblaApi]);
  
  const handleDotClick = (index: number) => {
    if (emblaApi) {
      emblaApi.scrollTo(index);
    }
  };

  return {
    images,
    currentIndex,
    loading,
    error,
    emblaRef,
    emblaApi,
    handleDotClick,
  };
}

export type { ArtworkImage };
