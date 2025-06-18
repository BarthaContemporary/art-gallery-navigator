
import { useCallback, useRef } from 'react';
import L from 'leaflet';
import { useGeocoding } from './useGeocoding';
import { createCustomIcon, createPopupContent } from '@/utils/mapUtils';

export function useMapInitialization() {
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const { geocodeAddress } = useGeocoding();

  const cleanupMap = useCallback(() => {
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
  }, []);

  const initializeMap = useCallback(async (
    mapContainer: HTMLDivElement,
    address: string,
    clientName: string
  ) => {
    if (!address || !address.trim()) {
      throw new Error("No address provided");
    }

    if (!mapContainer) {
      throw new Error("Map container not ready");
    }

    console.log('Initializing OpenStreetMap for address:', address);
    
    // Clean up existing map
    cleanupMap();
    
    // Initialize map with default center
    const mapInstance = L.map(mapContainer, {
      zoomControl: true,
      attributionControl: true,
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
      scrollWheelZoom: true,
      boxZoom: true,
      keyboard: true,
    }).setView([40.7128, -74.0060], 13);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(mapInstance);

    mapInstanceRef.current = mapInstance;

    // Geocode the address
    const location = await geocodeAddress(address.trim());
    
    // Center map on the location
    mapInstance.setView([location.lat, location.lng], 16);
    
    // Create custom marker
    const customIcon = createCustomIcon();
    
    // Add marker
    const marker = L.marker([location.lat, location.lng], { icon: customIcon }).addTo(mapInstance);
    
    // Add popup
    const popupContent = createPopupContent(clientName, location.display_name);
    marker.bindPopup(popupContent);

    markerRef.current = marker;

    // Auto-open popup briefly
    setTimeout(() => {
      marker.openPopup();
      setTimeout(() => marker.closePopup(), 3000);
    }, 500);

    console.log('Map initialized successfully');
  }, [geocodeAddress, cleanupMap]);

  return {
    initializeMap,
    cleanupMap,
    mapInstanceRef,
    markerRef
  };
}
