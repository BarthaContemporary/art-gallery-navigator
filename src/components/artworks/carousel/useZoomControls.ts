
import { useState, useCallback, useRef } from "react";

interface PanPosition {
  x: number;
  y: number;
}

export function useZoomControls() {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isZoomed, setIsZoomed] = useState(false);
  const [panPosition, setPanPosition] = useState<PanPosition>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<PanPosition>({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState<PanPosition>({ x: 0, y: 0 });

  // Zoom levels: 1x, 1.5x, 2x, 3x, 4x
  const zoomLevels = [1, 1.5, 2, 3, 4];

  const handleZoomIn = useCallback(() => {
    const currentZoomIndex = zoomLevels.indexOf(zoomLevel);
    if (currentZoomIndex < zoomLevels.length - 1) {
      const newZoom = zoomLevels[currentZoomIndex + 1];
      setZoomLevel(newZoom);
      setIsZoomed(newZoom > 1);
      // Reset pan when zooming
      if (newZoom === 1) {
        setPanPosition({ x: 0, y: 0 });
      }
    }
  }, [zoomLevel, zoomLevels]);

  const handleZoomOut = useCallback(() => {
    const currentZoomIndex = zoomLevels.indexOf(zoomLevel);
    if (currentZoomIndex > 0) {
      const newZoom = zoomLevels[currentZoomIndex - 1];
      setZoomLevel(newZoom);
      setIsZoomed(newZoom > 1);
      // Reset pan when zooming out to 1x
      if (newZoom === 1) {
        setPanPosition({ x: 0, y: 0 });
      }
    }
  }, [zoomLevel, zoomLevels]);

  const handleZoomReset = useCallback(() => {
    setZoomLevel(1);
    setIsZoomed(false);
    setPanPosition({ x: 0, y: 0 });
  }, []);

  const resetZoom = useCallback(() => {
    setZoomLevel(1);
    setIsZoomed(false);
    setPanPosition({ x: 0, y: 0 });
  }, []);

  // Pan/drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setPanStart(panPosition);
  }, [zoomLevel, panPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || zoomLevel <= 1) return;

    e.preventDefault();
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    // Limit pan boundaries based on zoom level
    const maxPan = 100 * (zoomLevel - 1);
    const newX = Math.max(-maxPan, Math.min(maxPan, panStart.x + deltaX));
    const newY = Math.max(-maxPan, Math.min(maxPan, panStart.y + deltaY));
    
    setPanPosition({ x: newX, y: newY });
  }, [isDragging, dragStart, panStart, zoomLevel]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (zoomLevel <= 1 || e.touches.length !== 1) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX, y: touch.clientY });
    setPanStart(panPosition);
  }, [zoomLevel, panPosition]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || zoomLevel <= 1 || e.touches.length !== 1) return;

    e.preventDefault();
    const touch = e.touches[0];
    const deltaX = touch.clientX - dragStart.x;
    const deltaY = touch.clientY - dragStart.y;
    
    const maxPan = 100 * (zoomLevel - 1);
    const newX = Math.max(-maxPan, Math.min(maxPan, panStart.x + deltaX));
    const newY = Math.max(-maxPan, Math.min(maxPan, panStart.y + deltaY));
    
    setPanPosition({ x: newX, y: newY });
  }, [isDragging, dragStart, panStart, zoomLevel]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const canZoomIn = zoomLevel < Math.max(...zoomLevels);
  const canZoomOut = zoomLevel > Math.min(...zoomLevels);

  return {
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
  };
}
