
import { useState, useCallback, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { supabase } from "@/integrations/supabase/client";

interface ArtworkImage {
  id: string;
  artwork_id: string;
  image_url: string;
  thumbnail_url?: string | null;
  medium_url?: string | null;
  is_primary: boolean;
  display_order: number;
  processed?: boolean;
}

export function useArtworkCarousel(artworkId: string) {
  const [images, setImages] = useState<ArtworkImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false,
    align: "center",
    slidesToScroll: 1,
    containScroll: "trimSnaps",
    skipSnaps: false,
  });

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const newIndex = emblaApi.selectedScrollSnap();
    console.log(`[useArtworkCarousel] Carousel selected index: ${newIndex}`);
    setCurrentIndex(newIndex);
  }, [emblaApi]);

  const handleDotClick = useCallback((index: number) => {
    if (!emblaApi) {
      console.warn(`[useArtworkCarousel] Cannot scroll to ${index}: emblaApi not ready`);
      return;
    }
    console.log(`[useArtworkCarousel] Scrolling to index ${index}`);
    emblaApi.scrollTo(index);
  }, [emblaApi]);

  const scrollPrev = useCallback(() => {
    if (!emblaApi) {
      console.warn(`[useArtworkCarousel] Cannot scroll prev: emblaApi not ready`);
      return;
    }
    console.log(`[useArtworkCarousel] Scrolling previous`);
    emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (!emblaApi) {
      console.warn(`[useArtworkCarousel] Cannot scroll next: emblaApi not ready`);
      return;
    }
    console.log(`[useArtworkCarousel] Scrolling next`);
    emblaApi.scrollNext();
  }, [emblaApi]);

  // Set up event listeners when emblaApi changes
  useEffect(() => {
    if (!emblaApi) {
      console.log(`[useArtworkCarousel] Embla API not ready yet`);
      return;
    }
    
    console.log(`[useArtworkCarousel] Setting up Embla API listeners`);
    
    // Set initial state
    onSelect();
    
    // Add event listeners
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    
    return () => {
      console.log(`[useArtworkCarousel] Cleaning up Embla API listeners`);
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  // Reset carousel when images change
  useEffect(() => {
    if (emblaApi && images.length > 0) {
      console.log(`[useArtworkCarousel] Reinitializing carousel with ${images.length} images`);
      emblaApi.reInit();
      setCurrentIndex(0);
    }
  }, [emblaApi, images]);

  useEffect(() => {
    async function fetchArtworkImages() {
      if (!artworkId) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        console.log(`[useArtworkCarousel] Fetching images for artwork: ${artworkId}`);
        
        const { data, error: fetchError } = await supabase
          .from("artwork_images")
          .select("*")
          .eq("artwork_id", artworkId)
          .order("display_order", { ascending: true });
          
        if (fetchError) throw fetchError;
        
        console.log(`[useArtworkCarousel] Found ${data?.length || 0} images for artwork ${artworkId}`);
        
        // Sort images to ensure primary image comes first
        const sortedImages = (data || []).sort((a, b) => {
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
          return a.display_order - b.display_order;
        });
        
        setImages(sortedImages as ArtworkImage[]);
        setCurrentIndex(0);
        setLoading(false);
      } catch (err) {
        console.error("[useArtworkCarousel] Error fetching artwork images:", err);
        setError("Failed to load images");
        setLoading(false);
      }
    }
    
    fetchArtworkImages();
  }, [artworkId]);

  const canScrollPrev = emblaApi?.canScrollPrev() ?? false;
  const canScrollNext = emblaApi?.canScrollNext() ?? false;

  console.log(`[useArtworkCarousel] Current state - index: ${currentIndex}, canPrev: ${canScrollPrev}, canNext: ${canScrollNext}, emblaReady: ${!!emblaApi}`);

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
    canScrollPrev,
    canScrollNext,
  };
}

export type { ArtworkImage };
