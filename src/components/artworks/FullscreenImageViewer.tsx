import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { ZoomableImage } from "./carousel/ZoomableImage";
import { useZoomControls } from "./carousel/useZoomControls";
import { ZoomControls } from "./carousel/ZoomControls";
import type { ImageRecord } from "@/utils/image-url-resolver";

interface FullscreenImageViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: any[];
  currentIndex: number;
  artworkTitle: string;
  onNavigate?: (index: number) => void;
  hideCloseButton?: boolean;
}

export function FullscreenImageViewer({
  open,
  onOpenChange,
  images,
  currentIndex,
  artworkTitle,
  onNavigate,
  hideCloseButton = false
}: FullscreenImageViewerProps) {
  const {
    zoomLevel,
    isZoomed,
    panPosition,
    isDragging,
    canZoomIn,
    canZoomOut,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    resetZoom,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useZoomControls();

  const currentImage = images[currentIndex];
  const hasMultipleImages = images.length > 1;
  const canGoNext = currentIndex < images.length - 1;
  const canGoPrev = currentIndex > 0;

  // Reset zoom when changing images or opening modal
  React.useEffect(() => {
    resetZoom();
  }, [currentIndex, open, resetZoom]);

  // Handle keyboard navigation
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      } else if (e.key === 'ArrowLeft' && canGoPrev && onNavigate) {
        onNavigate(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && canGoNext && onNavigate) {
        onNavigate(currentIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, currentIndex, canGoNext, canGoPrev, onNavigate, onOpenChange]);

  const handleNext = () => {
    if (canGoNext && onNavigate) {
      onNavigate(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (canGoPrev && onNavigate) {
      onNavigate(currentIndex - 1);
    }
  };

  if (!currentImage) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none max-h-none w-screen h-screen p-0 m-0 bg-black border-none overflow-hidden">
        <div className="w-full h-full bg-black group relative">
          {/* Close button */}
          {!hideCloseButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 h-10 w-10 p-0"
            >
              <X className="h-5 w-5" />
            </Button>
          )}

          {/* Navigation arrows */}
          {hasMultipleImages && canGoPrev && onNavigate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}

          {hasMultipleImages && canGoNext && onNavigate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          )}

          {/* Zoom Controls */}
          <ZoomControls
            zoomLevel={zoomLevel}
            isZoomed={isZoomed}
            canZoomIn={canZoomIn}
            canZoomOut={canZoomOut}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleZoomReset}
          />

          {/* Main image container */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-full flex items-center justify-center">
              <ZoomableImage
                imageRecord={{
                  id: currentImage.id,
                  image_url: currentImage.large_storage_path 
                    ? `https://cvhdspyugfcvkrufqzrq.supabase.co/storage/v1/object/public/artwork-images-processed/${currentImage.large_storage_path}`
                    : currentImage.medium_storage_path 
                      ? `https://cvhdspyugfcvkrufqzrq.supabase.co/storage/v1/object/public/artwork-images-processed/${currentImage.medium_storage_path}`
                      : '/placeholder.svg',
                  medium_url: currentImage.medium_storage_path 
                    ? `https://cvhdspyugfcvkrufqzrq.supabase.co/storage/v1/object/public/artwork-images-processed/${currentImage.medium_storage_path}`
                    : undefined,
                  thumbnail_url: currentImage.thumbnail_storage_path
                    ? `https://cvhdspyugfcvkrufqzrq.supabase.co/storage/v1/object/public/artwork-images-processed/${currentImage.thumbnail_storage_path}`
                    : undefined,
                } as ImageRecord}
                title={artworkTitle}
                className="w-full h-full"
                tier="full"
                priority={true}
                zoomLevel={zoomLevel}
                panPosition={panPosition}
                isDragging={isDragging}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />
            </div>
          </div>

          {/* Image counter */}
          {hasMultipleImages && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-black/60 text-white px-3 py-1 rounded-md text-sm backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {currentIndex + 1} / {images.length}
            </div>
          )}

          {/* Image title */}
          <div className="absolute bottom-4 left-4 z-50 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <h3 className="text-lg font-semibold">{artworkTitle}</h3>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}