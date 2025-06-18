
import { useEffect, useRef, useState } from "react";
import { MapPin, ExternalLink, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader } from "@googlemaps/js-api-loader";

interface AddressMapProps {
  address: string;
  clientName: string;
}

export function AddressMap({ address, clientName }: AddressMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const formatAddressForGeocoding = (rawAddress: string) => {
    // Replace all types of line breaks with commas and spaces
    return rawAddress
      .replace(/\r\n/g, ', ')  // Windows line breaks
      .replace(/\n/g, ', ')    // Unix line breaks
      .replace(/\r/g, ', ')    // Mac line breaks
      .replace(/,\s*,/g, ',')  // Remove duplicate commas
      .replace(/,\s*$/, '')    // Remove trailing comma
      .trim();
  };

  const openGoogleMaps = () => {
    if (address) {
      const formattedAddress = formatAddressForGeocoding(address);
      const encodedAddress = encodeURIComponent(formattedAddress);
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
      window.open(googleMapsUrl, '_blank');
    }
  };

  const cleanupMap = () => {
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
    // Google Maps instance cleanup is handled automatically
    mapInstanceRef.current = null;
  };

  const geocodeAddress = async (addressToGeocode: string): Promise<{ lat: number; lng: number; formatted_address: string }> => {
    const formattedAddress = formatAddressForGeocoding(addressToGeocode);
    
    console.log('Original address:', addressToGeocode);
    console.log('Formatted address for geocoding:', formattedAddress);
    
    const response = await fetch('https://cvhdspyugfcvkrufqzrq.supabase.co/functions/v1/geocode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2aGRzcHl1Z2ZjdmtydWZxenJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5ODkxOTIsImV4cCI6MjA2MDU2NTE5Mn0.NT2RKvxlHAuzTDXg9u2K4zq65dNnqfnKTxjpeMDeN6Y`,
      },
      body: JSON.stringify({ address: formattedAddress }),
    });
    
    if (!response.ok) {
      throw new Error('Geocoding service unavailable');
    }
    
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }
    
    if (!data.results || data.results.length === 0) {
      throw new Error('Address not found');
    }
    
    const result = data.results[0];
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formatted_address: result.formatted_address
    };
  };

  const initializeMap = async () => {
    if (!mapRef.current || !address?.trim()) return;
    
    setIsLoading(true);
    setError(null);

    try {
      console.log('Initializing Google Maps for address:', address);
      
      // Clean up existing map
      cleanupMap();
      
      // Geocode the address first
      const location = await geocodeAddress(address.trim());
      
      // Load Google Maps - we'll use a dummy key for the loader since we're using edge functions for geocoding
      const loader = new Loader({
        apiKey: "dummy-key-for-maps-only",
        version: "weekly",
        libraries: ["places"]
      });

      const google = await loader.load();
      
      // Wait for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Initialize map centered on the location
      const mapInstance = new google.maps.Map(mapRef.current, {
        center: { lat: location.lat, lng: location.lng },
        zoom: 16,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
      });

      mapInstanceRef.current = mapInstance;

      // Add marker
      const marker = new google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: mapInstance,
        title: clientName,
      });

      // Create info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; font-family: system-ui, sans-serif;">
            <h3 style="margin: 0 0 4px 0; font-weight: 600; font-size: 14px; color: #1f2937;">${clientName}</h3>
            <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.4;">${location.formatted_address}</p>
          </div>
        `,
      });

      marker.addListener('click', () => {
        infoWindow.open(mapInstance, marker);
      });

      markerRef.current = marker;

      // Auto-open info window briefly
      setTimeout(() => {
        infoWindow.open(mapInstance, marker);
        setTimeout(() => infoWindow.close(), 3000);
      }, 500);

      console.log('Google Maps initialized successfully');
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
          <p className="text-xs text-gray-500">{formatAddressForGeocoding(address)}</p>
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
            <p className="text-xs text-gray-500">{formatAddressForGeocoding(address)}</p>
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
