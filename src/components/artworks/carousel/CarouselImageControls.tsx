
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";

interface CarouselImageControlsProps {
  isVisible: boolean;
  isZoomed: boolean;
  onToggleZoom: () => void;
}

export function CarouselImageControls({
  isVisible,
  isZoomed,
  onToggleZoom,
}: CarouselImageControlsProps) {
  if (!isVisible) return null;

  return (
    <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
      <Button
        variant="secondary"
        size="sm"
        onClick={onToggleZoom}
        className="bg-background/80 hover:bg-background/90"
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
    </div>
  );
}
