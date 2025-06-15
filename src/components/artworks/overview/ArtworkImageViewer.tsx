
import React, { useState, useRef } from "react";
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
  const [imageLoading, setImageLoading] = useState(true);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [imageOffset, setImageOffset] = useState<{ x: number, y: number }>({ x: 0, y: 0 });

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

  // Increase zoom scale
  const zoomScale = isZoomed ? 2.2 : 1; // 220%
  const panEnabled = isZoomed && currentImage.image_url !== "/placeholder.svg";

  // Drag/pan handlers for zoomed image
  function onImageDragStart(e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) {
    if (!panEnabled) return;
    const x = 'touches' in e ? e.touches[0].clientX : e.nativeEvent.clientX;
    const y = 'touches' in e ? e.touches[0].clientY : e.nativeEvent.clientY;
    setDragStart({ x, y });
  }

  function onImageDragMove(e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) {
    if (!dragStart || !panEnabled) return;
    const x = 'touches' in e ? e.touches[0].clientX : e.nativeEvent.clientX;
    const y = 'touches' in e ? e.touches[0].clientY : e.nativeEvent.clientY;
    setImageOffset(offset => ({
      x: offset.x + (x - dragStart.x),
      y: offset.y + (y - dragStart.y)
    }));
    setDragStart({ x, y });
  }

  function onImageDragEnd() {
    setDragStart(null);
  }

  const goToPrevious = () => {
    setCurrentIndex(prev => prev === 0 ? displayImages.length - 1 : prev - 1);
    setImageOffset({ x: 0, y: 0 }); // reset pan
  };

  const goToNext = () => {
    setCurrentIndex(prev => prev === displayImages.length - 1 ? 0 : prev + 1);
    setImageOffset({ x: 0, y: 0 }); // reset pan
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
      {/* Controls: Move to Top-Left */}
      <div className="absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={e => {
            e.stopPropagation();
            setIsZoomed(!isZoomed);
            setImageOffset({ x: 0, y: 0 }); // Reset offset on toggle
          }}
          className="bg-black/20 backdrop-blur-sm border border-white/20 text-white hover:bg-black/40 hover:text-white"
        >
          {isZoomed ? (<><ZoomOut className="h-4 w-4 mr-1" />Zoom Out</>) : (<><ZoomIn className="h-4 w-4 mr-1" />Zoom In</>)}
        </Button>
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

      {/* Main image container with enhanced zoom/panning */}
      <div
        ref={imageContainerRef}
        className={`w-full h-full flex items-center justify-center ${isZoomed ? 'overflow-auto bg-black' : 'overflow-hidden'}`}
        onClick={() => setIsZoomed(!isZoomed)}
        style={{
          cursor: isZoomed ? "grab" : "zoom-in",
          touchAction: panEnabled ? "none" : undefined
        }}
        onMouseDown={onImageDragStart}
        onMouseMove={onImageDragMove}
        onMouseUp={onImageDragEnd}
        onMouseLeave={onImageDragEnd}
        onTouchStart={onImageDragStart}
        onTouchMove={onImageDragMove}
        onTouchEnd={onImageDragEnd}
      >
        <img
          src={currentImage.image_url}
          alt={`${artworkTitle} by ${artistName} (${currentIndex + 1} of ${displayImages.length})`}
          className={`
            max-w-full max-h-full object-contain transition-all duration-300
            ${isZoomed ? 'cursor-grab' : 'hover:scale-105'}
            ${imageLoading ? "opacity-0" : "opacity-100"}
          `}
          style={
            isZoomed
              ? {
                  transform: `scale(${zoomScale}) translate(${imageOffset.x / zoomScale}px, ${imageOffset.y / zoomScale}px)`,
                  transition: dragStart ? "none" : "transform 0.23s cubic-bezier(.4,2,.6,1)", // smooth out when not dragging
                  cursor: dragStart ? "grabbing" : "grab"
                }
              : {}
          }
          loading="lazy"
          onLoad={() => setImageLoading(false)}
          onError={() => setImageLoading(false)}
          draggable={false}
        />
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
            {/* Sleek Shimmer Loader */}
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-muted/20 to-muted/50 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-[shine_0.9s_linear_infinite]" style={{background: 'linear-gradient(90deg,transparent 0%,#fff6 60%,transparent 100%)'}} />
            </div>
          </div>
        )}
      </div>

      {/* Navigation arrows */}
      {displayImages.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/20 border border-white/20 text-white hover:bg-black/40 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/20 border border-white/20 text-white hover:bg-black/40 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Next image"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </>
      )}

      {/* Image counter */}
      {displayImages.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <div className="bg-black/20 border border-white/20 text-white px-2.5 py-0.5 rounded-full text-xs">{currentIndex + 1} of {displayImages.length}</div>
        </div>
      )}

      {/* Navigation dots smaller and spaced tighter */}
      {displayImages.length > 1 && displayImages.length <= 10 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <div className="flex gap-1 bg-black/15 border border-white/10 px-3 py-1 rounded-full">
            {displayImages.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentIndex(index);
                  setImageOffset({ x: 0, y: 0 });
                  setImageLoading(true);
                }}
                aria-label={`Go to slide ${index + 1}`}
                className={`
                  transition-all duration-150 
                  rounded-full
                  ${currentIndex === index 
                    ? "bg-white w-2.5 h-2.5"  // 10px active dot
                    : "bg-white/40 hover:bg-white/60 w-1.5 h-1.5"  // 6px inactive dot
                  }
                  border-none p-0
                `}
                style={{outline: "none", minWidth: 0, minHeight: 0}}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add keyframes for shine animation */}
      <style>{`
        @keyframes shine {
          from {transform:translateX(-100%);}
          to {transform:translateX(100%);}
        }
      `}</style>
    </div>
  );
}

