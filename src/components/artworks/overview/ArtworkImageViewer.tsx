
import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useArtwork } from "@/hooks/use-artworks";
import { toast } from "sonner";
import type { ArtworkImage } from "@/hooks/use-artworks";

interface ArtworkImageViewerProps {
  artworkId: string;
  artistName?: string;
  artworkTitle?: string;
}

export function ArtworkImageViewer({
  artworkId,
  artistName: initialArtistName = "Unknown_Artist",
  artworkTitle: initialArtworkTitle = "Untitled",
}: ArtworkImageViewerProps) {
  const { data: artwork, isLoading: loading, error: queryError } = useArtwork(artworkId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const images = artwork?.artwork_images || [];

  const displayImages: (ArtworkImage | { id: string, artwork_id: string, image_url: string, is_primary: boolean, display_order: number })[] = images.length > 0 ? images : [{
    id: "placeholder",
    artwork_id: artworkId,
    image_url: "/placeholder.svg",
    is_primary: true,
    display_order: 0
  }];

  const currentImage = displayImages[currentIndex];

  const artistName = artwork?.artist_name || initialArtistName;
  const artworkTitle = artwork?.title || initialArtworkTitle;


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

  if (loading && !artwork) {
    return (
      <div className="w-full h-[60vh] flex items-center justify-center bg-black/95">
        <div className="flex items-center gap-2 text-white">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
          <p className="text-white/80">Loading images...</p>
        </div>
      </div>
    );
  }

  if (queryError) {
    return (
      <div className="w-full h-[60vh] flex items-center justify-center bg-black/95">
        <p className="text-red-400">Error loading image details.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[60vh] bg-black/95 group">
      {/* Main image container */}
      <div 
        className={`w-full h-full cursor-pointer ${isZoomed ? 'overflow-auto' : 'overflow-hidden'} flex items-center justify-center`}
        onClick={() => setIsZoomed(!isZoomed)}
      >
        <img
          src={currentImage.image_url}
          alt={`${artworkTitle} by ${artistName} (${currentIndex + 1} of ${displayImages.length})`}
          className={`max-w-full max-h-full object-contain transition-all duration-300 ${
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
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-black/20 backdrop-blur-sm border border-white/20 text-white hover:bg-black/40 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-black/20 backdrop-blur-sm border border-white/20 text-white hover:bg-black/40 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Next image"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </>
      )}

      {/* Controls */}
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex gap-2">
        {/* Zoom control */}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setIsZoomed(!isZoomed);
          }}
          className="bg-black/20 backdrop-blur-sm border border-white/20 text-white hover:bg-black/40 hover:text-white"
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
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="bg-black/20 backdrop-blur-sm border border-white/20 text-white hover:bg-black/40 hover:text-white"
          >
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
        )}
      </div>

      {/* Image counter */}
      {displayImages.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <div className="bg-black/20 backdrop-blur-sm border border-white/20 text-white px-3 py-1 rounded-full text-sm">
            {currentIndex + 1} of {displayImages.length}
          </div>
        </div>
      )}

      {/* Navigation dots */}
      {displayImages.length > 1 && displayImages.length <= 10 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <div className="flex gap-2 bg-black/20 backdrop-blur-sm border border-white/20 rounded-full px-3 py-2">
            {displayImages.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                aria-label={`Go to slide ${index + 1}`}
                className={`rounded-full transition-all duration-200 hover:scale-125 ${
                  currentIndex === index 
                    ? "bg-white w-3 h-3" 
                    : "bg-white/40 hover:bg-white/60 w-2 h-2"
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
