import { useEffect, useState, useCallback } from "react";
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselNext, 
  CarouselPrevious 
} from "@/components/ui/carousel";
import { supabase } from "@/integrations/supabase/client";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { toast } from "sonner";
import JSZip from "jszip";

interface ArtworkImage {
  id: string;
  artwork_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
}

interface ArtworkCarouselProps {
  artworkId: string;
  artistName?: string;
  artworkTitle?: string;
}

export function ArtworkCarousel({ artworkId, artistName = "Unknown_Artist", artworkTitle = "Untitled" }: ArtworkCarouselProps) {
  const [images, setImages] = useState<ArtworkImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: true,
    align: "start",
    slidesToScroll: 1,
    containScroll: "trimSnaps" 
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
      } catch (err) {
        console.error("Error fetching artwork images:", err);
        setError("Failed to load images");
      } finally {
        setLoading(false);
      }
    }
    
    fetchArtworkImages();
  }, [artworkId]);
  
  const displayImages = images.length > 0 ? images : [{ id: "main", artwork_id: artworkId, image_url: "", is_primary: true, display_order: 0 }];
  
  if (loading) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-secondary/20">
        <p className="text-muted-foreground">Loading images...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-secondary/20">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }
  
  const formatFileName = (artistName: string, artworkTitle: string) => {
    return `B_c-${artistName}-${artworkTitle}`.replace(/[^a-zA-Z0-9-_]/g, '_');
  };

  const handleDownload = async (imageUrl: string, index: number) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const zip = new JSZip();
      const baseFileName = formatFileName(artistName, artworkTitle);
      
      zip.file(`${baseFileName}_${index + 1}-${images.length}.jpg`, blob);
      
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${baseFileName}_${index + 1}-${images.length}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      
      toast.success("Image downloaded successfully");
    } catch (error) {
      console.error("Error downloading image:", error);
      toast.error("Failed to download image");
    }
  };

  const handleDotClick = (index: number) => {
    if (emblaApi) {
      emblaApi.scrollTo(index);
    }
  };

  return (
    <div className="relative">
      <div className="w-full">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {displayImages.map((image, index) => (
              <div key={image.id} className="flex-[0_0_100%] min-w-0 group relative">
                <AspectRatio ratio={4/3} className="bg-secondary/20">
                  <img
                    src={image.image_url || "/placeholder.svg"}
                    alt="Artwork image"
                    className="w-full h-full object-contain"
                  />
                  {image.image_url && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(image.image_url, index);
                      }}
                    >
                      <Download className="h-4 w-4" />
                      <span className="sr-only">Download image</span>
                    </Button>
                  )}
                </AspectRatio>
              </div>
            ))}
          </div>
        </div>

        {displayImages.length > 1 && (
          <>
            <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
              <button onClick={() => emblaApi?.scrollPrev()} className="h-8 w-8 rounded-full bg-white shadow-md flex items-center justify-center">
                <span className="sr-only">Previous slide</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="m15 18-6-6 6-6"></path>
                </svg>
              </button>
            </div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
              <button onClick={() => emblaApi?.scrollNext()} className="h-8 w-8 rounded-full bg-white shadow-md flex items-center justify-center">
                <span className="sr-only">Next slide</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="m9 18 6-6-6-6"></path>
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
      
      {displayImages.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {displayImages.map((_, index) => (
            <button
              key={index}
              className={`h-2 w-2 rounded-full transition-colors ${
                index === currentIndex ? "bg-primary" : "bg-secondary"
              }`}
              onClick={() => handleDotClick(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
