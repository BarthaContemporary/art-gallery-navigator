
import { useState, useEffect, useRef } from "react";
import { useGeocoding } from "./useGeocoding";
import { useGoogleMaps } from "./useGoogleMaps";

export const useAddressMap = (address: string, clientName: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const initializationRef = useRef<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const geocodedLocationRef = useRef<any>(null);
  
  const { geocodeAddress } = useGeocoding();
  const { 
    mapRef, 
    isMounted, 
    cleanupMap, 
    loadGoogleMapsScript, 
    createMap,
    isMapContainerReady,
    isScriptLoaded 
  } = useGoogleMaps();

  const initializeMap = async () => {
    // Prevent multiple concurrent initializations
    if (initializationRef.current) {
      console.log('Map initialization already in progress, skipping...');
      return;
    }

    console.log('initializeMap called, checking conditions...');
    console.log('mapRef.current:', !!mapRef.current);
    console.log('isMounted:', isMounted);
    console.log('address:', address?.trim());
    console.log('isMapContainerReady:', isMapContainerReady());
    
    if (!mapRef.current || !isMounted || !address?.trim() || !isMapContainerReady()) {
      console.log('Conditions not met for map initialization');
      if (!isMapContainerReady()) {
        setError("Map container not ready. Please try again.");
      }
      return;
    }
    
    initializationRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      console.log('Starting map initialization for address:', address);
      
      // Clean up any existing map first
      cleanupMap();
      
      // Wait for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify container is still available after cleanup
      if (!mapRef.current || !isMounted || !isMapContainerReady()) {
        throw new Error('Map container not available after cleanup');
      }

      // Geocode the address if not already geocoded
      let location = geocodedLocationRef.current;
      if (!location) {
        location = await geocodeAddress(address.trim());
        geocodedLocationRef.current = location; // Store for retries
      }
      console.log('Geocoding successful, location:', location);
      
      // Load Google Maps script if not already loaded
      if (!isScriptLoaded()) {
        await loadGoogleMapsScript();
      }

      // Final check before map creation
      if (!mapRef.current || !isMounted || !isMapContainerReady()) {
        console.error('Map ref or component became unavailable after script loading');
        throw new Error('Map container not available for map creation');
      }

      // Create the map
      await createMap(location, clientName);

      console.log('Map initialization completed successfully');
      setRetryCount(0);
    } catch (err) {
      console.error("Map initialization error:", err);
      const errorMessage = (err as Error).message;
      
      if (errorMessage.includes("not found")) {
        setError("Address not found. Please check the address format.");
      } else if (errorMessage.includes("API key")) {
        setError("Google Maps API key not configured. Please contact administrator.");
      } else if (errorMessage.includes("service") || errorMessage.includes("unavailable")) {
        setError("Map service temporarily unavailable. Please try again.");
      } else if (errorMessage.includes("container") || errorMessage.includes("not available")) {
        setError("Map display error - container issue detected. Please try again.");
      } else if (errorMessage.includes("API")) {
        setError("Map service configuration error. Please contact administrator.");
      } else {
        setError("Failed to load map. Please try again.");
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
      
      // Reset initialization flag and wait before retrying
      initializationRef.current = false;
      // Clear any cached location for a fresh retry
      if (retryCount >= 1) {
        geocodedLocationRef.current = null;
      }
      
      setTimeout(() => {
        initializeMap();
      }, 1000);
    } else {
      setError("Maximum retry attempts reached. Please try again later.");
    }
  };

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Reset initialization flag when dependencies change
    initializationRef.current = false;
    
    if (isMounted && address && address.trim()) {
      // Give the DOM time to render before initializing
      timeoutRef.current = setTimeout(() => {
        // Only initialize if container is ready
        if (isMapContainerReady()) {
          initializeMap();
        } else {
          console.log('Container not ready yet, delaying initialization');
          // Try again after a short delay
          timeoutRef.current = setTimeout(() => {
            if (isMapContainerReady()) {
              initializeMap();
            } else {
              setError("Map container issue. Please try again.");
            }
          }, 500);
        }
      }, 300);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
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
