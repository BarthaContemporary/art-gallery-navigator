
import { useEffect, useRef, useState } from "react";
import { MapPin, ExternalLink, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface AddressMapProps {
  address: string;
  clientName: string;
}

export function AddressMap({ address, clientName }: AddressMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const openGoogleMaps = () => {
    if (address) {
      const encodedAddress = encodeURIComponent(address);
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
      window.open(googleMapsUrl, '_blank');
    }
  };

  const cleanupMap = () => {
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
  };

  const geocodeAddress = async (addressToGeocode: string) => {
    const encodedAddress = encodeURIComponent(addressToGeocode);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'AddressMap/1.0'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Geocoding service unavailable');
    }
    
    const data = await response.json();
    if (data.length === 0) {
      throw new Error('Address not found');
    }
    
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      display_name: data[0].display_name
    };
  };

  const initializeMap = async () => {
    if (!mapRef.current || !address?.trim()) return;
    
    setIsLoading(true);
    setError(null);

    try {
      console.log('Initializing map for address:', address);
      
      // Clean up existing map
      cleanupMap();
      
      // Wait for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Initialize map with default center
      const mapInstance = L.map(mapRef.current, {
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
      
      // Add marker
      const marker = L.marker([location.lat, location.lng]).addTo(mapInstance);
      
      // Create popup content
      const popupContent = `
        <div style="padding: 8px; font-family: system-ui, sans-serif;">
          <h3 style="margin: 0 0 4px 0; font-weight: 600; font-size: 14px; color: #1f2937;">${clientName}</h3>
          <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.4;">${location.display_name}</p>
        </div>
      `;
      
      marker.bindPopup(popupContent);
      markerRef.current = marker;

      // Auto-open popup briefly
      setTimeout(() => {
        marker.openPopup();
        setTimeout(() => marker.closePopup(), 3000);
      }, 500);

      console.log('Map initialized successfully');
      setRetryCount(0);
    } catch (err) {
      console.error("Map initialization error:", err);
      const errorMessage = (err as Error).message;
      
      if (errorMessage.includes("not found")) {
        setError("Address not found. Please check the address format.");
      } else if (errorMessage.includes("service")) {
        setError("Map service temporarily unavailable");
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
      initializeMap();
    }
  };

  useEffect(() => {
    if (address && address.trim()) {
      initializeMap();
    }

    // Cleanup on unmount or address change
    return () => {
      cleanupMap();
    };
  }, [address, clientName]);

  if (isLoading) {
    return (
      <div className="relative w-full h-64 bg-gray-50 rounded border flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-sm text-gray-600 mb-1">Loading map...</p>
          <p className="text-xs text-gray-500">{address}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative w-full h-64 bg-gray-50 rounded border p-4 flex flex-col justify-center">
        <div className="text-center space-y-3">
          <MapPin className="h-8 w-8 mx-auto text-red-400" />
          <div>
            <p className="text-sm text-red-600 mb-1">{error}</p>
            <p className="text-xs text-gray-500">{address}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {retryCount < 3 && (
              <Button size="sm" variant="outline" onClick={handleRetry}>
                <RotateCcw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
            <Button size="sm" onClick={openGoogleMaps}>
              <ExternalLink className="h-3 w-3 mr-1" />
              Open in Google Maps
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-64 rounded border overflow-hidden">
      <div ref={mapRef} className="absolute inset-0" />
      <div className="absolute bottom-2 right-2">
        <Button
          size="sm"
          variant="secondary"
          className="bg-white/90 hover:bg-white shadow-sm"
          onClick={openGoogleMaps}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Open in Google Maps
        </Button>
      </div>
    </div>
  );
}
