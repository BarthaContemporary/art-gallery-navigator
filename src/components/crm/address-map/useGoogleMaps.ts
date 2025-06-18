
import { useRef, useState, useEffect } from "react";
import { LocationData } from "./types";

export const useGoogleMaps = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
      cleanupMap();
    };
  }, []);

  const cleanupMap = () => {
    console.log('Cleaning up map resources...');
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current = null;
    }
    setIsInitializing(false);
  };

  const loadGoogleMapsScript = async () => {
    if (window.google?.maps) {
      console.log('Google Maps already loaded');
      return;
    }

    console.log('Loading Google Maps script...');
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
        resolve(true);
      };
      script.onerror = (error) => {
        console.error('Failed to load Google Maps script:', error);
        reject(new Error('Failed to load Google Maps API'));
      };
      document.head.appendChild(script);
    });
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
        throw new Error('Map container element not found');
      }

      if (!isMounted) {
        throw new Error('Component not mounted');
      }

      // Verify Google Maps is loaded
      if (!window.google?.maps) {
        throw new Error('Google Maps API not loaded');
      }

      // Wait for DOM to be stable
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Final safety check
      if (!mapRef.current || !isMounted) {
        throw new Error('Map container became unavailable during initialization');
      }
      
      console.log('Creating Google Maps instance with location:', location);
      
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

      // Add marker
      const marker = new google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: mapInstance,
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
        infoWindow.open(mapInstance, marker);
      });

      markerRef.current = marker;

      // Show info window briefly
      setTimeout(() => {
        if (isMounted && mapInstanceRef.current) {
          infoWindow.open(mapInstance, marker);
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

  return {
    mapRef,
    isMounted,
    cleanupMap,
    loadGoogleMapsScript,
    createMap
  };
};
