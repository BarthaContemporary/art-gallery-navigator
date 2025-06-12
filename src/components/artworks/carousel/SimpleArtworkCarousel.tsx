
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ArtworkImage {
  id: string;
  artwork_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
}

interface SimpleArtworkCarouselProps {
  artworkId: string;
  artistName?: string;
  artworkTitle?: string;
  isDialogActive?: boolean;
}

export function SimpleArtworkCarousel({
  artworkId,
  artistName = "Unknown_Artist",
  artworkTitle = "Untitled",
  isDialogActive = false
}: SimpleArtworkCarouselProps) {
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
    setImageLoadingStates(prev => ({ ...prev, [imageId]: false }));
    setImageErrors(prev => ({ ...prev, [imageId]: true }));
  };

  const handleImageLoadStart = (imageId: string) => {
    setImageLoadingStates(prev => ({ ...prev, [imageId]: true }));
  };

  // Download functionality
  const formatFileName = (index: number, total: number) => {
    return `B_c-${artistName}-${artworkTitle}_${index + 1}-${total}`.replace(/[^a-zA-Z0-9-_]/g, '_');
  };

  const handleDownload = (imageUrl: string, index: number) => {
    try {
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = `${formatFileName(index, images.length)}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download image");
    }
  };

  // Toggle zoom
  const toggleZoom = (index: number) => {
    setZoomedIndex(zoomedIndex === index ? null : index);
  };

  if (loading) {
    return (
      <div className="w-full h-[350px] md:h-[600px] flex items-center justify-center bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading images...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[350px] md:h-[600px] flex items-center justify-center bg-muted/20">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  // Use placeholder if no images
  const displayImages = images.length > 0 ? images : [{
    id: "placeholder",
    artwork_id: artworkId,
    image_url: "/placeholder.svg",
    is_primary: true,
    display_order: 0
  }];

  const currentImage = displayImages[currentIndex];
  const isZoomed = zoomedIndex === currentIndex;

  return (
    <div className="relative w-full">
      {/* Main image container */}
      <div className="relative w-full h-[350px] md:h-[600px] bg-muted/20 rounded-lg overflow-hidden group">
        {/* Image */}
        <div 
          className={`w-full h-full overflow-hidden cursor-pointer ${
            isZoomed ? 'overflow-auto' : ''
          }`}
          onClick={() => toggleZoom(currentIndex)}
        >
          {imageLoadingStates[currentImage.id] && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20 z-10">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
          
          <img
            src={currentImage.image_url}
            alt={`${artworkTitle} by ${artistName} (${currentIndex + 1} of ${displayImages.length})`}
            className={`transition-all duration-300 ${
              isZoomed 
                ? 'w-auto h-auto min-w-full min-h-full object-contain cursor-zoom-out scale-150 origin-center' 
                : 'w-full h-full object-contain cursor-zoom-in hover:scale-105'
            }`}
            onLoadStart={() => handleImageLoadStart(currentImage.id)}
            onLoad={() => handleImageLoad(currentImage.id)}
            onError={() => handleImageError(currentImage.id)}
            loading="lazy"
          />
        </div>

        {/* Navigation arrows - only show if multiple images */}
        {displayImages.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background shadow-md flex items-center justify-center hover:bg-accent transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background shadow-md flex items-center justify-center hover:bg-accent transition-colors"
              aria-label="Next image"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Controls */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex gap-2">
          {/* Zoom control */}
          {currentImage.image_url !== "/placeholder.svg" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                toggleZoom(currentIndex);
              }}
              className="bg-background/80 hover:bg-background/90"
            >
              {isZoomed ? (
                <>
                  <ZoomOut className="h-4 w-4 mr-1" />
                  Zoom Out
                </>
              ) : (
                <>
                  <ZoomIn className="h-4 w-4 mr-1" />
                  Zoom In
                </>
              )}
            </Button>
          )}

          {/* Download menu */}
          {displayImages.length > 0 && displayImages[0].id !== "placeholder" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="bg-background/80 hover:bg-background/90">
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {displayImages.map((image, index) => (
                  <DropdownMenuItem 
                    key={image.id} 
                    onClick={() => handleDownload(image.image_url, index)}
                  >
                    Image {index + 1} of {displayImages.length}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Navigation dots */}
      {displayImages.length > 1 && (
        <div className="flex justify-center mt-4">
          <div className="flex gap-2">
            {displayImages.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
                className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                  currentIndex === index 
                    ? "bg-primary" 
                    : "bg-gray-300 hover:bg-gray-400"
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
