
import { AddressMapProps } from "./address-map/types";
import { useAddressMap } from "./address-map/useAddressMap";
import { formatAddressForGeocoding, openGoogleMaps } from "./address-map/utils";
import { MapLoadingDisplay } from "./address-map/MapLoadingDisplay";
import { MapErrorDisplay } from "./address-map/MapErrorDisplay";
import { MapDisplay } from "./address-map/MapDisplay";

export function AddressMap({ address, clientName }: AddressMapProps) {
  const { mapRef, isLoading, error, retryCount, handleRetry } = useAddressMap(address, clientName);

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
    <MapDisplay 
      mapRef={mapRef} 
      onOpenGoogleMaps={handleOpenGoogleMaps} 
    />
  );
}
