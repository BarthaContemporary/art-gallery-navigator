
import { useEffect, useRef, useState } from "react";
import { MapPin, ExternalLink, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMapInitialization } from "@/hooks/useMapInitialization";
import { useMapError } from "@/hooks/useMapError";
import { openGoogleMaps } from "@/utils/mapUtils";
import 'leaflet/dist/leaflet.css';

interface AddressMapProps {
  address: string;
  clientName: string;
}

export function AddressMap({ address, clientName }: AddressMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { initializeMap, cleanupMap } = useMapInitialization();
  const { error, canRetry, handleError, retry, resetError } = useMapError();

  const handleInitializeMap = async () => {
    if (!mapRef.current) return;
    
    setIsLoading(true);
    resetError();

    try {
      // Wait for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      await initializeMap(mapRef.current, address, clientName);
    } catch (err) {
      handleError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    if (retry()) {
      cleanupMap();
      handleInitializeMap();
    }
  };

  useEffect(() => {
    if (address && address.trim()) {
      handleInitializeMap();
    }

    // Cleanup on unmount or address change
    return () => {
      cleanupMap();
    };
  }, [address]);

  const handleMapClick = () => {
    if (address) {
      openGoogleMaps(address);
    }
  };

  if (isLoading) {
    return (
      <div className="relative w-full h-64 bg-gray-50 rounded border flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-sm text-gray-600 mb-1">Loading map...</p>
          <p className="text-xs text-gray-500">{address}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative w-full h-64 bg-gray-50 rounded border p-4 flex flex-col justify-center">
        <div className="text-center space-y-3">
          <MapPin className="h-8 w-8 mx-auto text-red-400" />
          <div>
            <p className="text-sm text-red-600 mb-1">{error}</p>
            <p className="text-xs text-gray-500">{address}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {canRetry && (
              <Button size="sm" variant="outline" onClick={handleRetry}>
                <RotateCcw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
            <Button size="sm" onClick={handleMapClick}>
              <ExternalLink className="h-3 w-3 mr-1" />
              Open in Google Maps
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-64 rounded border overflow-hidden">
      <div ref={mapRef} className="absolute inset-0" />
      <div className="absolute bottom-2 right-2">
        <Button
          size="sm"
          variant="secondary"
          className="bg-white/90 hover:bg-white shadow-sm"
          onClick={handleMapClick}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Open in Google Maps
        </Button>
      </div>
    </div>
  );
}
