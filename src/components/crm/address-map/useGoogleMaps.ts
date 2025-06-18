
import { useRef, useState, useEffect } from "react";
import { LocationData } from "./types";

export const useGoogleMaps = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const cleanupMap = () => {
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
    mapInstanceRef.current = null;
  };

  const loadGoogleMapsScript = async () => {
    if (!window.google) {
      console.log('Loading Google Maps script...');
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dw901SwHHqfeWM&libraries=places`;
      script.async = true;
      script.defer = true;
      
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      console.log('Google Maps script loaded');
    }
  };

  const createMap = async (location: LocationData, clientName: string) => {
    if (!mapRef.current || !isMounted) {
      throw new Error('Map container not ready');
    }

    await new Promise(resolve => setTimeout(resolve, 200));
    
    if (!mapRef.current || !isMounted) {
      throw new Error('Map container not ready for map creation');
    }
    
    console.log('Creating Google Maps instance...');
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

    const marker = new google.maps.Marker({
      position: { lat: location.lat, lng: location.lng },
      map: mapInstance,
      title: clientName,
      animation: google.maps.Animation.DROP
    });

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

    setTimeout(() => {
      if (isMounted) {
        infoWindow.open(mapInstance, marker);
        setTimeout(() => {
          if (isMounted) infoWindow.close();
        }, 3000);
      }
    }, 500);
  };

  return {
    mapRef,
    isMounted,
    cleanupMap,
    loadGoogleMapsScript,
    createMap
  };
};
