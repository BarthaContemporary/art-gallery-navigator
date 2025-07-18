/**
 * Phase 5: Full-Screen Image Viewer
 * 
 * Full-screen image viewer with:
 * - Zoom and pan controls
 * - Keyboard navigation  
 * - Touch gestures for mobile
 * - High-resolution image downloads
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Artwork } from "@/hooks/use-artworks";
import { ReliableArtworkImage } from "./ReliableArtworkImage";
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Download,
  Share2,
  Edit,
  Maximize2,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FullScreenImageViewerProps {
  artwork: Artwork | null;
  artworks: Artwork[];
  currentIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onEdit?: (artwork: Artwork) => void;
  onExport?: (artwork: Artwork) => void;
  onShare?: (artwork: Artwork) => void;
}

export function FullScreenImageViewer({
  artwork,
  artworks,
  currentIndex,
  open,
  onOpenChange,
  onNext,
  onPrevious,
  onEdit,
  onExport,
  onShare
}: FullScreenImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showInfo, setShowInfo] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);

  // Reset zoom and pan when artwork changes
  useEffect(() => {
    if (artwork) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [artwork?.id]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onOpenChange(false);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onPrevious?.();
          break;
        case 'ArrowRight':
          e.preventDefault();
          onNext?.();
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
          e.preventDefault();
          handleZoomOut();
          break;
        case '0':
          e.preventDefault();
          handleResetZoom();
          break;
        case 'i':
          e.preventDefault();
          setShowInfo(!showInfo);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onNext, onPrevious, showInfo]);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev * 1.5, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev / 1.5, 0.5));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Mouse drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.01;
    const newZoom = Math.min(Math.max(zoom + delta, 0.5), 5);
    setZoom(newZoom);
  }, [zoom]);

  if (!artwork) return null;

  const hasNext = currentIndex < artworks.length - 1;
  const hasPrevious = currentIndex > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] max-h-[100vh] w-full h-full p-0 border-0 bg-black/95">
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-white font-semibold text-lg">
                  {artwork.title}
                </h2>
                <Badge variant="secondary" className="bg-white/20 text-white">
                  {currentIndex + 1} of {artworks.length}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInfo(!showInfo)}
                  className="text-white hover:bg-white/20"
                >
                  <Info className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="text-white hover:bg-white/20"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Navigation arrows */}
          {hasPrevious && (
            <Button
              variant="ghost"
              size="lg"
              onClick={onPrevious}
              className="absolute left-4 z-50 text-white hover:bg-white/20 h-12 w-12 p-0"
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
          )}
          
          {hasNext && (
            <Button
              variant="ghost"
              size="lg"
              onClick={onNext}
              className="absolute right-4 z-50 text-white hover:bg-white/20 h-12 w-12 p-0"
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          )}

          {/* Image container */}
          <div
            ref={imageRef}
            className="relative w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <div
              className="transition-transform duration-200 ease-out"
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                transformOrigin: 'center center'
              }}
            >
              <ReliableArtworkImage
                artwork={artwork}
                tier="full"
                className="max-w-[90vw] max-h-[90vh] object-contain"
                preferCloudinary={true}
              />
            </div>
          </div>

          {/* Zoom controls */}
          <div className="absolute bottom-4 left-4 z-50 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              className="bg-black/60 text-white hover:bg-black/80"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetZoom}
              className="bg-black/60 text-white hover:bg-black/80"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoom >= 5}
              className="bg-black/60 text-white hover:bg-black/80"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {/* Action buttons */}
          <div className="absolute bottom-4 right-4 z-50 flex gap-2">
            {onShare && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onShare(artwork)}
                className="bg-black/60 text-white hover:bg-black/80"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            )}
            {onExport && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onExport(artwork)}
                className="bg-black/60 text-white hover:bg-black/80"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            {onEdit && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onEdit(artwork)}
                className="bg-black/60 text-white hover:bg-black/80"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Info panel */}
          {showInfo && (
            <div className="absolute top-16 right-4 bottom-16 w-80 bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white overflow-y-auto z-50">
              <h3 className="font-semibold text-lg mb-4">Artwork Details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-gray-400">Title</label>
                  <p>{artwork.title}</p>
                </div>
                <div>
                  <label className="text-gray-400">Artist</label>
                  <p>{artwork.artist_name || 'Unknown Artist'}</p>
                </div>
                {artwork.year && (
                  <div>
                    <label className="text-gray-400">Year</label>
                    <p>{artwork.year}</p>
                  </div>
                )}
                {artwork.medium_type && (
                  <div>
                    <label className="text-gray-400">Medium</label>
                    <p>{artwork.medium_type}</p>
                  </div>
                )}
                {artwork.materials && (
                  <div>
                    <label className="text-gray-400">Materials</label>
                    <p>{artwork.materials}</p>
                  </div>
                )}
                {artwork.dimensions && (
                  <div>
                    <label className="text-gray-400">Dimensions</label>
                    <p>{artwork.dimensions}</p>
                  </div>
                )}
                {artwork.price && (
                  <div>
                    <label className="text-gray-400">Price</label>
                    <p>
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: artwork.currency || 'USD'
                      }).format(artwork.price)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}