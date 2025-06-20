
import React, { useState, useRef, useCallback } from "react";
import { LocalArtworkImage } from "../LocalArtworkImage";
import { LocalImageRecord } from "@/services/local-image-service";
import { cn } from "@/lib/utils";

interface CarouselContainerProps {
  sortedImages: LocalImageRecord[];
  artworkTitle: string;
  currentIndex: number;
  zoomLevel: number;
  isZoomed: boolean;
  emblaRef: (node: HTMLDivElement | null) => void;
}

export function CarouselContainer({
  sortedImages,
  artworkTitle,
  currentIndex,
  zoomLevel,
  isZoomed,
  emblaRef,
}: CarouselContainerProps) {
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const panContainerRef = useRef<HTMLDivElement>(null);

  // Reset pan when zoom changes or slide changes
  React.useEffect(() => {
    setPanOffset({ x: 0, y: 0 });
  }, [zoomLevel, currentIndex]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isZoomed) return;
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - panOffset.x,
      y: e.clientY - panOffset.y,
    });
    e.preventDefault();
  }, [isZoomed, panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !isZoomed) return;

    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;

    // Calculate boundaries to prevent panning too far
    const container = panContainerRef.current;
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const imageWidth = containerRect.width * zoomLevel;
      const imageHeight = containerRect.height * zoomLevel;
      
      const maxX = Math.max(0, (imageWidth - containerRect.width) / 2);
      const maxY = Math.max(0, (imageHeight - containerRect.height) / 2);
      
      const clampedX = Math.max(-maxX, Math.min(maxX, newX));
      const clampedY = Math.max(-maxY, Math.min(maxY, newY));
      
      setPanOffset({ x: clampedX, y: clampedY });
    }
  }, [isDragging, isZoomed, dragStart, zoomLevel]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch event handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isZoomed || e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({
      x: touch.clientX - panOffset.x,
      y: touch.clientY - panOffset.y,
    });
    e.preventDefault();
  }, [isZoomed, panOffset]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || !isZoomed || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const newX = touch.clientX - dragStart.x;
    const newY = touch.clientY - dragStart.y;

    // Calculate boundaries to prevent panning too far
    const container = panContainerRef.current;
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const imageWidth = containerRect.width * zoomLevel;
      const imageHeight = containerRect.height * zoomLevel;
      
      const maxX = Math.max(0, (imageWidth - containerRect.width) / 2);
      const maxY = Math.max(0, (imageHeight - containerRect.height) / 2);
      
      const clampedX = Math.max(-maxX, Math.min(maxX, newX));
      const clampedY = Math.max(-maxY, Math.min(maxY, newY));
      
      setPanOffset({ x: clampedX, y: clampedY });
    }
    e.preventDefault();
  }, [isDragging, isZoomed, dragStart, zoomLevel]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className="h-full" ref={emblaRef}>
      <div className="flex h-full">
        {sortedImages.map((image, index) => (
          <div 
            key={image.id} 
            className={cn(
              "flex-none w-full h-full relative",
              // Hide non-current images when zoomed
              isZoomed && index !== currentIndex ? "hidden" : ""
            )}
          >
            <div 
              ref={index === currentIndex ? panContainerRef : null}
              className={cn(
                "w-full h-full transition-transform duration-300 ease-in-out",
                isZoomed ? "cursor-grab active:cursor-grabbing overflow-hidden" : "overflow-hidden",
                isDragging && "cursor-grabbing"
              )}
              style={{
                transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                transformOrigin: 'center center'
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <LocalArtworkImage
                imageRecord={image}
                title={`${artworkTitle} - Image ${index + 1}`}
                className="w-full h-full object-contain"
                size="large"
                showProcessingStatus={true}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
