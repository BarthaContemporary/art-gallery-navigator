
import { useState, useCallback } from "react";

export function useZoomControls() {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isZoomed, setIsZoomed] = useState(false);

  // Zoom levels: 1x, 1.5x, 2x, 3x, 4x
  const zoomLevels = [1, 1.5, 2, 3, 4];

  const handleZoomIn = useCallback(() => {
    const currentZoomIndex = zoomLevels.indexOf(zoomLevel);
    if (currentZoomIndex < zoomLevels.length - 1) {
      const newZoom = zoomLevels[currentZoomIndex + 1];
      setZoomLevel(newZoom);
      setIsZoomed(newZoom > 1);
    }
  }, [zoomLevel, zoomLevels]);

  const handleZoomOut = useCallback(() => {
    const currentZoomIndex = zoomLevels.indexOf(zoomLevel);
    if (currentZoomIndex > 0) {
      const newZoom = zoomLevels[currentZoomIndex - 1];
      setZoomLevel(newZoom);
      setIsZoomed(newZoom > 1);
    }
  }, [zoomLevel, zoomLevels]);

  const handleZoomReset = useCallback(() => {
    setZoomLevel(1);
    setIsZoomed(false);
  }, []);

  const resetZoom = useCallback(() => {
    setZoomLevel(1);
    setIsZoomed(false);
  }, []);

  const canZoomIn = zoomLevel < Math.max(...zoomLevels);
  const canZoomOut = zoomLevel > Math.min(...zoomLevels);

  return {
    zoomLevel,
    isZoomed,
    canZoomIn,
    canZoomOut,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    resetZoom,
  };
}
