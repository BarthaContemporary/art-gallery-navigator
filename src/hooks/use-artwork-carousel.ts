
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
  const [imageLoadingStates, setImageLoadingStates] = useState<Record<string, boolean>>({});
  const imagesLoadedRef = useRef<Set<string>>(new Set());
  
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: true,
    align: "center",
    slidesToScroll: 1,
    containScroll: "trimSnaps",
    watchDrag: true,
    skipSnaps: false,
    duration: 25,
    dragFree: false,
    inViewThreshold: 0.7
  });

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const newIndex = emblaApi.selectedScrollSnap();
    setCurrentIndex(newIndex);
    
    // Preload adjacent images
    const totalImages = images.length;
    if (totalImages > 0) {
      const prevIndex = (newIndex - 1 + totalImages) % totalImages;
      const nextIndex = (newIndex + 1) % totalImages;
      
      [prevIndex, nextIndex].forEach(index => {
        const image = images[index];
        if (image && !imagesLoadedRef.current.has(image.id)) {
          const img = new Image();
          img.src = image.medium_url || image.image_url;
          img.onload = () => {
            imagesLoadedRef.current.add(image.id);
          };
        }
      });
    }
  }, [emblaApi, images]);

  useEffect(() => {
    if (!emblaApi) return;
    
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
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
        
        console.log(`Fetching images for artwork: ${artworkId}`);
        
        const { data, error: fetchError } = await supabase
          .from("artwork_images")
          .select("*")
          .eq("artwork_id", artworkId)
          .order("display_order", { ascending: true });
          
        if (fetchError) throw fetchError;
        
        if (!controller.signal.aborted) {
          console.log(`Found ${data?.length || 0} images for artwork ${artworkId}`);
          
          // Sort images to ensure primary image comes first, then by display_order
          const sortedImages = (data || []).sort((a, b) => {
            if (a.is_primary && !b.is_primary) return -1;
            if (!a.is_primary && b.is_primary) return 1;
            return a.display_order - b.display_order;
          });
          
          setImages(sortedImages as ArtworkImage[]);
          setCurrentIndex(0);
          
          // Reset image loading states
          setImageLoadingStates({});
          imagesLoadedRef.current.clear();
          
          // Preload the first image
          if (sortedImages.length > 0) {
            const firstImage = sortedImages[0];
            const img = new Image();
            img.src = firstImage.medium_url || firstImage.image_url;
            img.onload = () => {
              imagesLoadedRef.current.add(firstImage.id);
            };
          }
          
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

  const canScrollPrev = emblaApi?.canScrollPrev() ?? false;
  const canScrollNext = emblaApi?.canScrollNext() ?? false;

  const markImageAsLoading = useCallback((imageId: string) => {
    setImageLoadingStates(prev => ({ ...prev, [imageId]: true }));
  }, []);

  const markImageAsLoaded = useCallback((imageId: string) => {
    setImageLoadingStates(prev => ({ ...prev, [imageId]: false }));
    imagesLoadedRef.current.add(imageId);
  }, []);

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
    imageLoadingStates,
    markImageAsLoading,
    markImageAsLoaded,
  };
}

export type { ArtworkImage };
