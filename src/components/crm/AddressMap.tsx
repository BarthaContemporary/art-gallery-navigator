
import { AddressMapProps } from "./address-map/types";
import { useMapManager } from "./address-map/useMapManager";
import { formatAddressForGeocoding, openGoogleMaps } from "./address-map/utils";
import { MapLoadingDisplay } from "./address-map/MapLoadingDisplay";
import { MapErrorDisplay } from "./address-map/MapErrorDisplay";
import { MapContainer } from "./address-map/MapContainer";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export function AddressMap({ address, clientName }: AddressMapProps) {
  const { containerRef, isLoading, error, retryCount, handleRetry } = useMapManager(address, clientName);

  const handleOpenGoogleMaps = () => openGoogleMaps(address);

  if (isLoading) {
    return (
      <MapLoadingDisplay 
        address={address} 
        formatAddressForGeocoding={formatAddressForGeocoding} 
      />
    );
  }

  if (error) {
    return (
      <MapErrorDisplay
        error={error}
        address={address}
        retryCount={retryCount}
        onRetry={handleRetry}
        onOpenGoogleMaps={handleOpenGoogleMaps}
        formatAddressForGeocoding={formatAddressForGeocoding}
      />
    );
  }

  return (
    <MapContainer containerRef={containerRef}>
      <div className="absolute bottom-2 right-2">
        <Button
          size="sm"
          variant="secondary"
          className="bg-white/90 hover:bg-white shadow-sm"
          onClick={handleOpenGoogleMaps}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Open in Google Maps
        </Button>
      </div>
    </MapContainer>
  );
}
