
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
    align: "center",
    slidesToScroll: 1,
    containScroll: "trimSnaps",
    draggable: true
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
    async function fetchArtworkImages() {
      try {
        setLoading(true);
        setError(null);
        
        const { data, error } = await supabase
          .from("artwork_images")
          .select("*")
          .eq("artwork_id", artworkId)
          .order("display_order", { ascending: true });
          
        if (error) throw error;
        
        setImages(data as ArtworkImage[]);
        
        // Reset to first slide when images change
        if (emblaApi && data.length > 0) {
          setTimeout(() => {
            emblaApi.scrollTo(0);
          }, 0);
        }
      } catch (err) {
        console.error("Error fetching artwork images:", err);
        setError("Failed to load images");
      } finally {
        setLoading(false);
      }
    }
    
    fetchArtworkImages();
  }, [artworkId, emblaApi]);
  
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
