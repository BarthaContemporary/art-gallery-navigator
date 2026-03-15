
import { useRef, useState, useEffect } from "react";
import { LocationData } from "./types";

export const useGoogleMaps = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
      cleanupMap();
    };
  }, []);

  const cleanupMap = () => {
    console.log('Cleaning up map resources...');
    
    try {
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      
      if (mapInstanceRef.current) {
        // Allow garbage collection of the map instance
        mapInstanceRef.current = null;
      }
    } catch (err) {
      console.error('Error during map cleanup:', err);
    }
    
    setIsInitializing(false);
  };

  const loadGoogleMapsScript = async () => {
    if (window.google?.maps) {
      console.log('Google Maps already loaded');
      scriptLoadedRef.current = true;
      return;
    }

    console.log('Loading Google Maps script...');
    
    try {
      const script = document.createElement('script');
      
      // Use environment variable for API key
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        throw new Error('Google Maps API key not configured');
      }
      
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      
      await new Promise((resolve, reject) => {
        script.onload = () => {
          console.log('Google Maps script loaded successfully');
          scriptLoadedRef.current = true;
          resolve(true);
        };
        script.onerror = (error) => {
          console.error('Failed to load Google Maps script:', error);
          reject(new Error('Failed to load Google Maps API'));
        };
        document.head.appendChild(script);
      });
    } catch (error) {
      console.error('Error loading Google Maps script:', error);
      throw error;
    }
  };

  const createMap = async (location: LocationData, clientName: string) => {
    if (isInitializing) {
      console.log('Map creation already in progress, skipping...');
      return;
    }

    setIsInitializing(true);
    
    try {
      console.log('Starting map creation process...');
      
      // Ensure we have a valid container
      if (!mapRef.current) {
        console.error('Map container element not found - createMap');
        throw new Error('Map container element not found');
      }

      if (!isMounted) {
        console.error('Component not mounted - createMap');
        throw new Error('Component not mounted');
      }

      // Verify Google Maps is loaded
      if (!window.google?.maps) {
        console.error('Google Maps API not loaded - createMap');
        throw new Error('Google Maps API not loaded');
      }

      // Wait for DOM to be stable
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Final safety check
      if (!mapRef.current || !isMounted) {
        console.error('Map container became unavailable during initialization');
        throw new Error('Map container became unavailable during initialization');
      }
      
      console.log('Creating Google Maps instance with location:', location);
      
      // Attempt to create the map - wrap in try/catch to get detailed errors
      try {
        const mapInstance = new google.maps.Map(mapRef.current, {
          center: { lat: location.lat, lng: location.lng },
          zoom: 16,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
          zoomControl: true,
          mapTypeId: google.maps.MapTypeId.ROADMAP
        });

        mapInstanceRef.current = mapInstance;
        console.log('Google Maps instance created successfully');
      } catch (mapError) {
        console.error('Error creating map instance:', mapError);
        throw new Error(`Map creation failed: ${mapError.message || 'Unknown error'}`);
      }

      // Add marker
      const marker = new google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: mapInstanceRef.current,
        title: clientName,
        animation: google.maps.Animation.DROP
      });

      // Create info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; font-family: system-ui, sans-serif; max-width: 250px;">
            <h3 style="margin: 0 0 4px 0; font-weight: 600; font-size: 14px; color: #1f2937;">${clientName}</h3>
            <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.4;">${location.formatted_address}</p>
          </div>
        `,
      });

      marker.addListener('click', () => {
        infoWindow.open(mapInstanceRef.current, marker);
      });

      markerRef.current = marker;

      // Show info window briefly
      setTimeout(() => {
        if (isMounted && mapInstanceRef.current) {
          infoWindow.open(mapInstanceRef.current, marker);
          setTimeout(() => {
            if (isMounted && mapInstanceRef.current) {
              infoWindow.close();
            }
          }, 3000);
        }
      }, 500);

      console.log('Map creation completed successfully');
    } catch (error) {
      console.error('Error during map creation:', error);
      throw error;
    } finally {
      setIsInitializing(false);
    }
  };

  // This function checks if the map container is ready and visible
  const isMapContainerReady = () => {
    if (!mapRef.current) {
      console.log('Map container ref is null');
      return false;
    }
    
    const container = mapRef.current;
    
    // Check if element is connected to DOM
    if (!container.isConnected) {
      console.log('Map container is not connected to DOM');
      return false;
    }
    
    // Check if element has dimensions
    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0) {
      console.log('Map container has zero width or height');
      return false;
    }
    
    return true;
  };

  return {
    mapRef,
    isMounted,
    cleanupMap,
    loadGoogleMapsScript,
    createMap,
    isMapContainerReady,
    isScriptLoaded: () => scriptLoadedRef.current
  };
};
