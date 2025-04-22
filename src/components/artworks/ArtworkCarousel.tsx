
import { useEffect, useState } from "react";
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselNext, 
  CarouselPrevious 
} from "@/components/ui/carousel";
import { supabase } from "@/integrations/supabase/client";
import { AspectRatio } from "@/components/ui/aspect-ratio";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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
  
  // If there are no images, use the main artwork image
  const displayImages = images.length > 0 ? images : [{ id: "main", artwork_id: artworkId, image_url: "", is_primary: true, display_order: 0 }];
  
  if (loading) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-secondary/20">
        <p className="text-muted-foreground">Loading images...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-secondary/20">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }
  
  return (
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
  );
}
