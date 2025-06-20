
import { useState, useCallback, useEffect, useRef } from "react";
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
  const [isCarouselReady, setIsCarouselReady] = useState(false);
  const initTimeoutRef = useRef<NodeJS.Timeout>();
  
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false,
    align: "start",
    slidesToScroll: 1,
    containScroll: "trimSnaps",
    skipSnaps: false,
    dragFree: false,
  });

  // Stable onSelect callback
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const newIndex = emblaApi.selectedScrollSnap();
    console.log(`[Carousel] Selected slide ${newIndex}`);
    setCurrentIndex(newIndex);
  }, [emblaApi]);

  // Initialize carousel when emblaApi becomes available
  useEffect(() => {
    if (!emblaApi) {
      console.log(`[Carousel] Embla API not ready`);
      setIsCarouselReady(false);
      return;
    }

    console.log(`[Carousel] Setting up Embla API with ${images.length} images`);
    
    // Clear any existing timeout
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
    }

    // Small delay to ensure DOM is ready
    initTimeoutRef.current = setTimeout(() => {
      try {
        // Set initial state
        onSelect();
        
        // Add event listeners
        emblaApi.on("select", onSelect);
        emblaApi.on("reInit", onSelect);
        
        setIsCarouselReady(true);
        console.log(`[Carousel] Embla API ready with ${emblaApi.slideNodes().length} slides`);
      } catch (err) {
        console.error(`[Carousel] Error initializing Embla:`, err);
        setIsCarouselReady(false);
      }
    }, 100);

    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
      if (emblaApi) {
        emblaApi.off("select", onSelect);
        emblaApi.off("reInit", onSelect);
      }
      console.log(`[Carousel] Cleaned up Embla API listeners`);
    };
  }, [emblaApi, onSelect, images.length]);

  // Reinitialize carousel when images change
  useEffect(() => {
    if (emblaApi && images.length > 0 && isCarouselReady) {
      console.log(`[Carousel] Reinitializing with ${images.length} images`);
      emblaApi.reInit();
      setCurrentIndex(0);
    }
  }, [emblaApi, images, isCarouselReady]);

  // Navigation functions
  const handleDotClick = useCallback((index: number) => {
    if (!emblaApi || !isCarouselReady) {
      console.warn(`[Carousel] Cannot scroll to ${index}: carousel not ready`);
      return;
    }
    console.log(`[Carousel] Scrolling to slide ${index}`);
    emblaApi.scrollTo(index);
  }, [emblaApi, isCarouselReady]);

  const scrollPrev = useCallback(() => {
    if (!emblaApi || !isCarouselReady) {
      console.warn(`[Carousel] Cannot scroll prev: carousel not ready`);
      return;
    }
    console.log(`[Carousel] Scrolling previous`);
    emblaApi.scrollPrev();
  }, [emblaApi, isCarouselReady]);

  const scrollNext = useCallback(() => {
    if (!emblaApi || !isCarouselReady) {
      console.warn(`[Carousel] Cannot scroll next: carousel not ready`);
      return;
    }
    console.log(`[Carousel] Scrolling next`);
    emblaApi.scrollNext();
  }, [emblaApi, isCarouselReady]);

  // Fetch artwork images
  useEffect(() => {
    async function fetchArtworkImages() {
      if (!artworkId) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        console.log(`[Carousel] Fetching images for artwork: ${artworkId}`);
        
        const { data, error: fetchError } = await supabase
          .from("artwork_images")
          .select("*")
          .eq("artwork_id", artworkId)
          .order("display_order", { ascending: true });
          
        if (fetchError) throw fetchError;
        
        console.log(`[Carousel] Found ${data?.length || 0} images`);
        
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
        console.error("[Carousel] Error fetching images:", err);
        setError("Failed to load images");
        setLoading(false);
      }
    }
    
    fetchArtworkImages();
  }, [artworkId]);

  // Get navigation state
  const canScrollPrev = emblaApi?.canScrollPrev() ?? false;
  const canScrollNext = emblaApi?.canScrollNext() ?? false;

  console.log(`[Carousel] State - index: ${currentIndex}/${images.length - 1}, canPrev: ${canScrollPrev}, canNext: ${canScrollNext}, ready: ${isCarouselReady}`);

  return {
    images,
    currentIndex,
    loading,
    error,
    emblaRef,
    emblaApi,
    isCarouselReady,
    handleDotClick,
    scrollPrev,
    scrollNext,
    canScrollPrev,
    canScrollNext,
  };
}

export type { ArtworkImage };
