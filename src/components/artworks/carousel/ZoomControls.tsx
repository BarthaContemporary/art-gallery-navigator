
import React from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ZoomControlsProps {
  zoomLevel: number;
  isZoomed: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export function ZoomControls({
  zoomLevel,
  isZoomed,
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: ZoomControlsProps) {
  return (
    <div className="absolute top-4 left-4 z-30 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <Button
        variant="secondary"
        size="sm"
        className="w-8 h-8 p-0 bg-black/40 hover:bg-black/60 text-white border-none backdrop-blur-sm"
        onClick={onZoomIn}
        disabled={!canZoomIn}
      >
        <ZoomIn className="w-4 h-4" />
      </Button>
      
      <Button
        variant="secondary"
        size="sm"
        className="w-8 h-8 p-0 bg-black/40 hover:bg-black/60 text-white border-none backdrop-blur-sm"
        onClick={onZoomOut}
        disabled={!canZoomOut}
      >
        <ZoomOut className="w-4 h-4" />
      </Button>
      
      {isZoomed && (
        <Button
          variant="secondary"
          size="sm"
          className="w-8 h-8 p-0 bg-black/40 hover:bg-black/60 text-white border-none backdrop-blur-sm"
          onClick={onZoomReset}
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      )}
      
      {/* Zoom Level Indicator */}
      {isZoomed && (
        <div className="bg-black/40 text-white px-2 py-1 rounded text-xs backdrop-blur-sm text-center">
          {zoomLevel}x
        </div>
      )}
    </div>
  );
}
