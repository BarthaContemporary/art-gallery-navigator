import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { ArtworkImageRenderer } from "../ArtworkImageRenderer";
import type { ImageRecord } from "@/utils/image-url-resolver";

interface ZoomableImageProps {
  imageRecord?: ImageRecord;
  title: string;
  className?: string;
  tier?: 'thumbnail' | 'medium' | 'full';
  priority?: boolean;
  zoomLevel: number;
  panPosition: { x: number; y: number };
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

export function ZoomableImage({
  imageRecord,
  title,
  className,
  tier = 'full',
  priority = false,
  zoomLevel,
  panPosition,
  isDragging,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onTouchStart,
  onTouchMove,
  onTouchEnd
}: ZoomableImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Add global mouse events for dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      onMouseMove(e as any);
    };

    const handleGlobalMouseUp = () => {
      onMouseUp();
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, onMouseMove, onMouseUp]);

  // Cursor styles based on zoom and drag state
  const getCursorStyle = () => {
    if (zoomLevel <= 1) return 'default';
    if (isDragging) return 'grabbing';
    return 'grab';
  };

  return (
    <div
      ref={containerRef}
      className={cn("w-full h-full overflow-hidden", className)}
      style={{
        cursor: getCursorStyle()
      }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="w-full h-full transition-transform duration-200 ease-out"
        style={{
          transform: `scale(${zoomLevel}) translate(${panPosition.x}px, ${panPosition.y}px)`,
          transformOrigin: 'center center',
          willChange: zoomLevel > 1 ? 'transform' : 'auto'
        }}
      >
        <ArtworkImageRenderer
          imageRecord={imageRecord}
          title={title}
          className="w-full h-full"
          tier={tier}
          priority={priority}
        />
      </div>
    </div>
  );
}