
import { MapPin, ExternalLink, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MapErrorDisplayProps {
  error: string;
  address: string;
  retryCount: number;
  onRetry: () => void;
  onOpenGoogleMaps: () => void;
  formatAddressForGeocoding: (address: string) => string;
}

export function MapErrorDisplay({ 
  error, 
  address, 
  retryCount, 
  onRetry, 
  onOpenGoogleMaps,
  formatAddressForGeocoding 
}: MapErrorDisplayProps) {
  return (
    <div className="relative w-full h-64 bg-gray-50 rounded border p-4 flex flex-col justify-center">
      <div className="text-center space-y-3">
        <MapPin className="h-8 w-8 mx-auto text-red-400" />
        <div>
          <p className="text-sm text-red-600 mb-1">{error}</p>
          <p className="text-xs text-gray-500">{formatAddressForGeocoding(address)}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {retryCount < 3 && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RotateCcw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          )}
          <Button size="sm" onClick={onOpenGoogleMaps}>
            <ExternalLink className="h-3 w-3 mr-1" />
            Open in Google Maps
          </Button>
        </div>
      </div>
    </div>
  );
}
