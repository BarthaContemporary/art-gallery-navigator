
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CarouselDownloadMenu } from "./CarouselDownloadMenu";

interface CarouselImageControlsProps {
  isZoomed: boolean;
  currentImageUrl: string;
  hasImages: boolean;
  images: Array<{ id: string; image_url: string }>;
  artistName: string;
  artworkTitle: string;
  onToggleZoom: () => void;
}

export function CarouselImageControls({
  isZoomed,
  currentImageUrl,
  hasImages,
  images,
  artistName,
  artworkTitle,
  onToggleZoom,
}: CarouselImageControlsProps) {
  return (
    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex gap-2">
      {/* Zoom control */}
      {currentImageUrl !== "/placeholder.svg" && (
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onToggleZoom();
          }}
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
      )}

      {/* Download menu */}
      {hasImages && images[0]?.id !== "placeholder" && (
        <CarouselDownloadMenu
          images={images}
          artistName={artistName}
          artworkTitle={artworkTitle}
        />
      )}
    </div>
  );
}
