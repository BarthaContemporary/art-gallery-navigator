
import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useArtworkImages } from "@/hooks/use-artwork-images";
import { toast } from "sonner";

interface ArtworkImageViewerProps {
  artworkId: string;
  artistName?: string;
  artworkTitle?: string;
}

export function ArtworkImageViewer({
  artworkId,
  artistName = "Unknown_Artist",
  artworkTitle = "Untitled",
}: ArtworkImageViewerProps) {
  const { images, loading, error } = useArtworkImages(artworkId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const displayImages = images.length > 0 ? images : [{
    id: "placeholder",
    artwork_id: artworkId,
    image_url: "/placeholder.svg",
    is_primary: true,
    display_order: 0
  }];

  const currentImage = displayImages[currentIndex];

  const goToPrevious = () => {
    setCurrentIndex(prev => prev === 0 ? displayImages.length - 1 : prev - 1);
  };

  const goToNext = () => {
    setCurrentIndex(prev => prev === displayImages.length - 1 ? 0 : prev + 1);
  };

  const handleDownload = () => {
    if (!currentImage || currentImage.image_url === "/placeholder.svg") return;
    
    const fileName = `${artistName}-${artworkTitle}_${currentIndex + 1}-${displayImages.length}`.replace(/[^a-zA-Z0-9-_]/g, '_');
    
    try {
      const link = document.createElement("a");
      link.href = currentImage.image_url;
      link.download = `${fileName}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Download started");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download image");
    }
  };

  if (loading) {
    return (
      <div className="w-full h-[350px] md:h-[500px] flex items-center justify-center bg-muted/20 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading images...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[350px] md:h-[500px] flex items-center justify-center bg-muted/20 rounded-lg">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main image container */}
      <div className="relative w-full h-[350px] md:h-[500px] bg-muted/20 rounded-lg overflow-hidden group">
        {/* Image */}
        <div 
          className={`w-full h-full cursor-pointer ${isZoomed ? 'overflow-auto' : 'overflow-hidden'}`}
          onClick={() => setIsZoomed(!isZoomed)}
        >
          <img
            src={currentImage.image_url}
            alt={`${artworkTitle} by ${artistName} (${currentIndex + 1} of ${displayImages.length})`}
            className={`w-full h-full object-contain transition-all duration-300 ${
              isZoomed 
                ? 'scale-150 cursor-zoom-out' 
                : 'hover:scale-105 cursor-zoom-in'
            }`}
            loading="lazy"
          />
        </div>

        {/* Navigation arrows */}
        {displayImages.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm shadow-md flex items-center justify-center hover:bg-background transition-colors opacity-0 group-hover:opacity-100"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm shadow-md flex items-center justify-center hover:bg-background transition-colors opacity-0 group-hover:opacity-100"
              aria-label="Next image"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Controls */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex gap-2">
          {/* Zoom control */}
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setIsZoomed(!isZoomed);
            }}
            className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
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

          {/* Download */}
          {currentImage.image_url !== "/placeholder.svg" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownload}
              className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
            >
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
          )}
        </div>
      </div>

      {/* Navigation dots */}
      {displayImages.length > 1 && (
        <div className="flex justify-center">
          <div className="flex gap-2">
            {displayImages.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                aria-label={`Go to slide ${index + 1}`}
                className={`rounded-full transition-all duration-200 hover:scale-125 ${
                  currentIndex === index 
                    ? "bg-primary w-3 h-3" 
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50 w-2 h-2"
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
