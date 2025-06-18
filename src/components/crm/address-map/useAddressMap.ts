
import { useState, useEffect, useRef } from "react";
import { useGeocoding } from "./useGeocoding";
import { useGoogleMaps } from "./useGoogleMaps";

export const useAddressMap = (address: string, clientName: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const initializationRef = useRef<boolean>(false);
  
  const { geocodeAddress } = useGeocoding();
  const { mapRef, isMounted, cleanupMap, loadGoogleMapsScript, createMap } = useGoogleMaps();

  const initializeMap = async () => {
    // Prevent multiple concurrent initializations
    if (initializationRef.current) {
      console.log('Map initialization already in progress, skipping...');
      return;
    }

    console.log('initializeMap called, checking conditions...');
    console.log('mapRef.current:', mapRef.current);
    console.log('isMounted:', isMounted);
    console.log('address:', address?.trim());
    
    if (!mapRef.current || !isMounted || !address?.trim()) {
      console.log('Conditions not met for map initialization');
      return;
    }
    
    initializationRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      console.log('Starting map initialization for address:', address);
      
      // Clean up any existing map first
      cleanupMap();
      
      // Wait a bit after cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify container is still available after cleanup
      if (!mapRef.current || !isMounted) {
        throw new Error('Map container not available after cleanup');
      }

      const location = await geocodeAddress(address.trim());
      console.log('Geocoding successful, location:', location);
      
      await loadGoogleMapsScript();

      // Final check before map creation
      if (!mapRef.current || !isMounted) {
        console.error('Map ref or component became unavailable after geocoding');
        throw new Error('Map container not available for map creation');
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
      } else if (errorMessage.includes("container") || errorMessage.includes("not available")) {
        setError("Map display error - container issue detected");
      } else if (errorMessage.includes("API")) {
        setError("Map service configuration error");
      } else {
        setError("Failed to load map");
      }
    } finally {
      setIsLoading(false);
      initializationRef.current = false;
    }
  };

  const handleRetry = () => {
    if (retryCount < 3) {
      console.log(`Retrying map initialization (attempt ${retryCount + 1})`);
      setRetryCount(prev => prev + 1);
      cleanupMap();
      
      // Reset initialization flag and wait a bit before retrying
      initializationRef.current = false;
      setTimeout(() => {
        initializeMap();
      }, 500);
    }
  };

  useEffect(() => {
    // Reset initialization flag when dependencies change
    initializationRef.current = false;
    
    if (isMounted && address && address.trim()) {
      const timeoutId = setTimeout(() => {
        initializeMap();
      }, 200);
      
      return () => {
        clearTimeout(timeoutId);
        initializationRef.current = false;
      };
    }

    return () => {
      cleanupMap();
      initializationRef.current = false;
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
