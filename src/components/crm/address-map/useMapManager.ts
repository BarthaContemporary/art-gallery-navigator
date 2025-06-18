
import { useRef, useEffect, useState, useCallback } from "react";
import { MapManager, MapManagerState } from "./MapManager";

export const useMapManager = (address: string, clientName: string) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapManagerRef = useRef<MapManager | null>(null);
  const [state, setState] = useState<MapManagerState>({
    state: 'idle',
    error: null,
    location: null,
    retryCount: 0
  });

  // Initialize map manager
  useEffect(() => {
    if (!mapManagerRef.current) {
      mapManagerRef.current = new MapManager(containerRef, setState);
    }
    
    return () => {
      if (mapManagerRef.current) {
        mapManagerRef.current.cleanup();
        mapManagerRef.current = null;
      }
    };
  }, []);

  // Initialize map when address changes
  useEffect(() => {
    if (!address?.trim() || !clientName?.trim() || !mapManagerRef.current) {
      return;
    }

    console.log('Initializing map for address:', address);
    mapManagerRef.current.initialize(address, clientName).catch(err => {
      console.error('Map initialization failed:', err);
    });

    return () => {
      if (mapManagerRef.current) {
        mapManagerRef.current.cleanup();
      }
    };
  }, [address, clientName]);

  const handleRetry = useCallback(() => {
    if (mapManagerRef.current && address?.trim() && clientName?.trim()) {
      mapManagerRef.current.retry(address, clientName).catch(err => {
        console.error('Map retry failed:', err);
      });
    }
  }, [address, clientName]);

  return {
    containerRef,
    isLoading: state.state === 'loading' || 
               state.state === 'geocoding' || 
               state.state === 'script-loading' || 
               state.state === 'map-creating',
    error: state.error,
    retryCount: state.retryCount,
    handleRetry,
    state: state.state
  };
};
