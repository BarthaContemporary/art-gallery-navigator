
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
  const [imagesLoaded, setImagesLoaded] = useState(0);
  
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

  // Track image loading to ensure carousel initializes after images are ready
  const handleImageLoadComplete = useCallback(() => {
    setImagesLoaded(prev => {
      const newCount = prev + 1;
      console.log(`[Carousel] Image loaded: ${newCount}/${images.length}`);
      return newCount;
    });
  }, [images.length]);

  // Initialize carousel when emblaApi becomes available and images are loaded
  useEffect(() => {
    if (!emblaApi || images.length === 0) {
      console.log(`[Carousel] Not ready - emblaApi: ${!!emblaApi}, images: ${images.length}`);
      setIsCarouselReady(false);
      return;
    }

    console.log(`[Carousel] Setting up Embla API with ${images.length} images`);
    
    // Clear any existing timeout
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
    }

    // Wait for at least one image to load or a reasonable timeout
    const initDelay = imagesLoaded > 0 ? 200 : 1000;
    
    initTimeoutRef.current = setTimeout(() => {
      try {
        // Force reInit to ensure proper slide detection
        emblaApi.reInit();
        
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
    }, initDelay);

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
  }, [emblaApi, onSelect, images.length, imagesLoaded]);

  // Reset images loaded counter when images change
  useEffect(() => {
    setImagesLoaded(0);
  }, [images]);

  // Navigation functions with improved error handling
  const handleDotClick = useCallback((index: number) => {
    if (!emblaApi || !isCarouselReady || index < 0 || index >= images.length) {
      console.warn(`[Carousel] Cannot scroll to ${index}: carousel not ready or invalid index`);
      return;
    }
    console.log(`[Carousel] Scrolling to slide ${index}`);
    try {
      emblaApi.scrollTo(index);
    } catch (error) {
      console.error(`[Carousel] Error scrolling to ${index}:`, error);
      // Fallback: manually set the index
      setCurrentIndex(index);
    }
  }, [emblaApi, isCarouselReady, images.length]);

  const scrollPrev = useCallback(() => {
    if (!emblaApi || !isCarouselReady) {
      console.warn(`[Carousel] Cannot scroll prev: carousel not ready`);
      // Fallback navigation
      setCurrentIndex(prev => Math.max(0, prev - 1));
      return;
    }
    console.log(`[Carousel] Scrolling previous`);
    try {
      emblaApi.scrollPrev();
    } catch (error) {
      console.error(`[Carousel] Error scrolling prev:`, error);
      setCurrentIndex(prev => Math.max(0, prev - 1));
    }
  }, [emblaApi, isCarouselReady]);

  const scrollNext = useCallback(() => {
    if (!emblaApi || !isCarouselReady) {
      console.warn(`[Carousel] Cannot scroll next: carousel not ready`);
      // Fallback navigation
      setCurrentIndex(prev => Math.min(images.length - 1, prev + 1));
      return;
    }
    console.log(`[Carousel] Scrolling next`);
    try {
      emblaApi.scrollNext();
    } catch (error) {
      console.error(`[Carousel] Error scrolling next:`, error);
      setCurrentIndex(prev => Math.min(images.length - 1, prev + 1));
    }
  }, [emblaApi, isCarouselReady, images.length]);

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

  // Get navigation state with fallbacks
  const canScrollPrev = emblaApi?.canScrollPrev() ?? (currentIndex > 0);
  const canScrollNext = emblaApi?.canScrollNext() ?? (currentIndex < images.length - 1);

  console.log(`[Carousel] State - index: ${currentIndex}/${images.length - 1}, canPrev: ${canScrollPrev}, canNext: ${canScrollNext}, ready: ${isCarouselReady}, loaded: ${imagesLoaded}/${images.length}`);

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
