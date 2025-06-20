
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

/**
 * Enhanced custom hook to manage the state and logic for an artwork image carousel.
 * Fetches artwork images from Supabase and integrates with Embla Carousel for navigation.
 * Includes improved error handling and image loading fallbacks.
 *
 * @param artworkId The ID of the artwork for which to display images.
 * @returns An object containing carousel state, images, and control functions.
 */
export function useArtworkCarousel(artworkId: string) {
  const [images, setImages] = useState<ArtworkImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLoadErrors, setImageLoadErrors] = useState<Record<string, boolean>>({});
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
        setImageLoadErrors({});
        
        console.log(`Fetching images for artwork: ${artworkId}`);
        
        const { data, error: fetchError } = await supabase
          .from("artwork_images")
          .select("*")
          .eq("artwork_id", artworkId)
          .order("display_order", { ascending: true });
          
        if (fetchError) throw fetchError;
        
        if (!controller.signal.aborted) {
          console.log(`Found ${data?.length || 0} images for artwork ${artworkId}:`, data?.map(img => ({
            id: img.id,
            display_order: img.display_order,
            is_primary: img.is_primary,
            has_thumbnail: !!img.thumbnail_url,
            has_medium: !!img.medium_url,
            has_image_url: !!img.image_url
          })));
          
          // Sort images to ensure primary image comes first, then by display_order
          const sortedImages = (data || []).sort((a, b) => {
            if (a.is_primary && !b.is_primary) return -1;
            if (!a.is_primary && b.is_primary) return 1;
            return a.display_order - b.display_order;
          });
          
          setImages(sortedImages as ArtworkImage[]);
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

  // Helper function to get the best available image URL with fallback chain
  const getImageUrl = useCallback((image: ArtworkImage): string => {
    // Try thumbnail_url first (fastest to load), then medium_url, then image_url
    const urls = [
      image.thumbnail_url,
      image.medium_url, 
      image.image_url
    ].filter(Boolean);
    
    // Find the first URL that hasn't failed to load
    for (const url of urls) {
      if (url && !imageLoadErrors[url]) {
        return url;
      }
    }
    
    // If all URLs have failed, return the original image_url as last resort
    return image.image_url || "/placeholder.svg";
  }, [imageLoadErrors]);

  // Track image load errors
  const handleImageError = useCallback((imageUrl: string, imageId: string) => {
    console.warn(`Image failed to load: ${imageUrl} for image ${imageId}`);
    setImageLoadErrors(prev => ({
      ...prev,
      [imageUrl]: true
    }));
  }, []);

  // Track successful image loads
  const handleImageLoad = useCallback((imageUrl: string, imageId: string) => {
    console.log(`Image loaded successfully: ${imageUrl} for image ${imageId}`);
  }, []);
  
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
    getImageUrl,
    handleImageError,
    handleImageLoad,
    imageLoadErrors,
  };
}

export type { ArtworkImage };
