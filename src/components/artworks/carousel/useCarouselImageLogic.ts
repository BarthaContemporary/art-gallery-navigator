
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ArtworkImage {
  id: string;
  artwork_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
}

export function useCarouselImageLogic(artworkId: string, isDialogActive: boolean = false) {
  const [images, setImages] = useState<ArtworkImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLoadingStates, setImageLoadingStates] = useState<Record<string, boolean>>({});
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);

  // Fetch images from Supabase
  useEffect(() => {
    async function fetchImages() {
      if (!artworkId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const { data, error: fetchError } = await supabase
          .from("artwork_images")
          .select("*")
          .eq("artwork_id", artworkId)
          .order("display_order", { ascending: true });
          
        if (fetchError) throw fetchError;
        
        setImages(data || []);
      } catch (err) {
        console.error("Error fetching artwork images:", err);
        setError("Failed to load images");
      } finally {
        setLoading(false);
      }
    }
    
    fetchImages();
  }, [artworkId]);

  // Navigation functions
  const goToPrevious = useCallback(() => {
    setCurrentIndex(prev => prev === 0 ? images.length - 1 : prev - 1);
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => prev === images.length - 1 ? 0 : prev + 1);
  }, [images.length]);

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isDialogActive) return;
    
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          goToPrevious();
          break;
        case "ArrowRight":
          event.preventDefault();
          goToNext();
          break;
        case "Escape":
          event.preventDefault();
          setZoomedIndex(null);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDialogActive, goToPrevious, goToNext]);

  // Image loading handlers
  const handleImageLoad = (imageId: string) => {
    setImageLoadingStates(prev => ({ ...prev, [imageId]: false }));
    setImageErrors(prev => ({ ...prev, [imageId]: false }));
  };

  const handleImageError = (imageId: string) => {
    console.error(`Failed to load image: ${imageId}`);
    setImageLoadingStates(prev => ({ ...prev, [imageId]: false }));
    setImageErrors(prev => ({ ...prev, [imageId]: true }));
  };

  const handleImageLoadStart = (imageId: string) => {
    setImageLoadingStates(prev => ({ ...prev, [imageId]: true }));
  };

  // Toggle zoom
  const toggleZoom = (index: number) => {
    setZoomedIndex(zoomedIndex === index ? null : index);
  };

  return {
    images,
    currentIndex,
    loading,
    error,
    imageLoadingStates,
    imageErrors,
    zoomedIndex,
    goToPrevious,
    goToNext,
    goToSlide,
    handleImageLoad,
    handleImageError,
    handleImageLoadStart,
    toggleZoom,
  };
}
