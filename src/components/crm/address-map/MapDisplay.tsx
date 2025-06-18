
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MapDisplayProps {
  mapRef: React.RefObject<HTMLDivElement>;
  onOpenGoogleMaps: () => void;
}

export function MapDisplay({ mapRef, onOpenGoogleMaps }: MapDisplayProps) {
  return (
    <div className="relative w-full h-64 rounded border overflow-hidden">
      <div ref={mapRef} className="absolute inset-0" />
      <div className="absolute bottom-2 right-2">
        <Button
          size="sm"
          variant="secondary"
          className="bg-white/90 hover:bg-white shadow-sm"
          onClick={onOpenGoogleMaps}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Open in Google Maps
        </Button>
      </div>
    </div>
  );
}
