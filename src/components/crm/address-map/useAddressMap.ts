
import { useState, useEffect } from "react";
import { useGeocoding } from "./useGeocoding";
import { useGoogleMaps } from "./useGoogleMaps";

export const useAddressMap = (address: string, clientName: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const { geocodeAddress } = useGeocoding();
  const { mapRef, isMounted, cleanupMap, loadGoogleMapsScript, createMap } = useGoogleMaps();

  const initializeMap = async () => {
    console.log('initializeMap called, checking conditions...');
    console.log('mapRef.current:', mapRef.current);
    console.log('isMounted:', isMounted);
    console.log('address:', address?.trim());
    
    if (!mapRef.current || !isMounted || !address?.trim()) {
      console.log('Conditions not met for map initialization');
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      console.log('Starting map initialization for address:', address);
      
      cleanupMap();
      
      const location = await geocodeAddress(address.trim());
      console.log('Geocoding successful, location:', location);
      
      await loadGoogleMapsScript();

      if (!mapRef.current) {
        console.error('Map ref became null after geocoding');
        throw new Error('Map container not available');
      }

      await createMap(location, clientName);

      console.log('Map initialization completed successfully');
      setRetryCount(0);
    } catch (err) {
      console.error("Map initialization error:", err);
      const errorMessage = (err as Error).message;
      
      if (errorMessage.includes("not found")) {
        setError("Address not found. Please check the address format.");
      } else if (errorMessage.includes("service") || errorMessage.includes("unavailable")) {
        setError("Map service temporarily unavailable");
      } else if (errorMessage.includes("container")) {
        setError("Map display error - please retry");
      } else {
        setError("Failed to load map");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    if (retryCount < 3) {
      setRetryCount(prev => prev + 1);
      cleanupMap();
      setTimeout(() => {
        initializeMap();
      }, 100);
    }
  };

  useEffect(() => {
    if (isMounted && address && address.trim()) {
      const timeoutId = setTimeout(() => {
        initializeMap();
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }

    return () => {
      cleanupMap();
    };
  }, [address, clientName, isMounted]);

  return {
    mapRef,
    isLoading,
    error,
    retryCount,
    handleRetry
  };
};
