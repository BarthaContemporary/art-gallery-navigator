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
import useEmblaCarousel from "embla-carousel-react";

interface ArtworkImage {
  id: string;
  artwork_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
}

interface ArtworkCarouselProps {
  artworkId: string;
}

export function ArtworkCarousel({ artworkId }: ArtworkCarouselProps) {
  const [images, setImages] = useState<ArtworkImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  
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
  
  return (
    <div className="relative">
      <div className="overflow-hidden" ref={emblaRef}>
        <Carousel className="w-full">
          <CarouselContent>
            {displayImages.map((image) => (
              <CarouselItem key={image.id}>
                <AspectRatio ratio={4/3} className="bg-secondary/20">
                  <img
                    src={image.image_url || "/placeholder.svg"}
                    alt="Artwork image"
                    className="w-full h-full object-contain"
                  />
                </AspectRatio>
              </CarouselItem>
            ))}
          </CarouselContent>
          {displayImages.length > 1 && (
            <>
              <CarouselPrevious className="left-2" />
              <CarouselNext className="right-2" />
            </>
          )}
        </Carousel>
      </div>
      
      {displayImages.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {displayImages.map((_, index) => (
            <div
              key={index}
              className={`h-2 w-2 rounded-full transition-colors cursor-pointer ${
                index === currentIndex ? "bg-primary" : "bg-secondary"
              }`}
              onClick={() => emblaApi?.scrollTo(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
