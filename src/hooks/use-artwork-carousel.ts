
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
  
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false,
    align: "start",
    slidesToScroll: 1,
  });

  // Initialize carousel when emblaApi becomes available
  useEffect(() => {
    if (!emblaApi || images.length === 0) {
      setIsCarouselReady(false);
      return;
    }

    console.log(`[Carousel] Setting up Embla API with ${images.length} images`);
    
    const onSelect = () => {
      const newIndex = emblaApi.selectedScrollSnap();
      console.log(`[Carousel] Selected slide ${newIndex}`);
      setCurrentIndex(newIndex);
    };

    // Wait a bit for DOM to be ready
    const timer = setTimeout(() => {
      emblaApi.reInit();
      onSelect();
      emblaApi.on("select", onSelect);
      setIsCarouselReady(true);
      console.log(`[Carousel] Embla API ready with ${emblaApi.slideNodes().length} slides`);
    }, 100);

    return () => {
      clearTimeout(timer);
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, images]);

  // Navigation functions
  const handleDotClick = useCallback((index: number) => {
    if (!emblaApi || !isCarouselReady) return;
    emblaApi.scrollTo(index);
  }, [emblaApi, isCarouselReady]);

  const scrollPrev = useCallback(() => {
    if (!emblaApi || !isCarouselReady) return;
    emblaApi.scrollPrev();
  }, [emblaApi, isCarouselReady]);

  const scrollNext = useCallback(() => {
    if (!emblaApi || !isCarouselReady) return;
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

  const handleImageLoadComplete = useCallback(() => {
    // Simple callback for when images load
  }, []);

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
    handleImageLoadComplete,
  };
}

export type { ArtworkImage };
