
import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, ExternalLink, RotateCcw } from "lucide-react";
import { Loader } from "@googlemaps/js-api-loader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

  const GOOGLE_MAPS_API_KEY = "AIzaSyB08-mQ7664oLlgrfPBgQQBK0Bw752Xyk4";
  const MAX_RETRIES = 2;

  const cleanupMap = useCallback(() => {
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
    if (mapInstanceRef.current) {
      // Google Maps doesn't have a direct cleanup method, but we can clear references
      mapInstanceRef.current = null;
    }
  }, []);

  const initializeMap = useCallback(async (attempt = 0) => {
    if (!address || !address.trim()) {
      setError("No address provided");
      return;
    }

    // Wait for DOM to be ready
    await new Promise(resolve => setTimeout(resolve, 100));

    if (!mapRef.current) {
      if (attempt < MAX_RETRIES) {
        console.log(`Map container not ready, retrying... (${attempt + 1}/${MAX_RETRIES})`);
        setTimeout(() => initializeMap(attempt + 1), 200);
        return;
      }
      setError("Map container failed to initialize");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('Initializing Google Maps for address:', address);
      
      const loader = new Loader({
        apiKey: GOOGLE_MAPS_API_KEY,
        version: "weekly",
        libraries: ["places", "geometry"]
      });

      const google = await loader.load();
      
      // Initialize map with a default center first
      const mapInstance = new google.maps.Map(mapRef.current, {
        zoom: 15,
        center: { lat: 40.7128, lng: -74.0060 }, // Default to NYC
        mapTypeControl: false,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
      });

      mapInstanceRef.current = mapInstance;

      // Geocode the address
      const geocoder = new google.maps.Geocoder();
      
      geocoder.geocode({ address: address.trim() }, (results, status) => {
        console.log('Geocoding status:', status, 'Results:', results);
        
        if (status === "OK" && results && results[0]) {
          const location = results[0].geometry.location;
          const formattedAddress = results[0].formatted_address;
          
          mapInstance.setCenter(location);
          mapInstance.setZoom(16);
          
          // Clean up existing marker
          if (markerRef.current) {
            markerRef.current.setMap(null);
          }
          
          // Add new marker
          const marker = new google.maps.Marker({
            position: location,
            map: mapInstance,
            title: `${clientName} - ${formattedAddress}`,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: "#3B82F6",
              fillOpacity: 1,
              strokeColor: "#FFFFFF",
              strokeWeight: 3,
            },
          });

          markerRef.current = marker;

          // Add info window
          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="padding: 12px; max-width: 250px; font-family: system-ui, sans-serif;">
                <h3 style="margin: 0 0 8px 0; font-weight: 600; font-size: 14px; color: #1f2937;">${clientName}</h3>
                <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.4;">${formattedAddress}</p>
              </div>
            `,
          });

          marker.addListener("click", () => {
            infoWindow.open(mapInstance, marker);
          });

          // Auto-open info window briefly
          setTimeout(() => {
            infoWindow.open(mapInstance, marker);
            setTimeout(() => infoWindow.close(), 3000);
          }, 500);

          console.log('Map initialized successfully');
          setRetryCount(0);
        } else {
          console.error('Geocoding failed:', status);
          if (status === "ZERO_RESULTS") {
            setError("Address not found. Please check the address format.");
          } else if (status === "OVER_QUERY_LIMIT") {
            setError("Too many requests. Please try again later.");
          } else {
            setError(`Could not locate address: ${status}`);
          }
        }
        setIsLoading(false);
      });
    } catch (err) {
      console.error("Google Maps initialization error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load Google Maps";
      
      if (errorMessage.includes("API key") || errorMessage.includes("quota")) {
        setError("Maps service temporarily unavailable");
      } else {
        setError("Failed to load map");
      }
      setIsLoading(false);
    }
  }, [address, clientName]);

  const handleRetry = useCallback(() => {
    if (retryCount < MAX_RETRIES) {
      setRetryCount(prev => prev + 1);
      cleanupMap();
      initializeMap();
    }
  }, [retryCount, cleanupMap, initializeMap]);

  useEffect(() => {
    if (address && address.trim()) {
      initializeMap();
    }

    // Cleanup on unmount or address change
    return () => {
      cleanupMap();
    };
  }, [address, initializeMap, cleanupMap]);

  const handleMapClick = () => {
    if (address) {
      const encodedAddress = encodeURIComponent(address);
      const mapUrl = `https://maps.google.com/maps?q=${encodedAddress}`;
      window.open(mapUrl, '_blank');
    }
  };

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
            {retryCount < MAX_RETRIES && (
              <Button size="sm" variant="outline" onClick={handleRetry}>
                <RotateCcw className="h-3 w-3 mr-1" />
                Retry ({retryCount + 1}/{MAX_RETRIES + 1})
              </Button>
            )}
            <Button size="sm" onClick={handleMapClick}>
              <ExternalLink className="h-3 w-3 mr-1" />
              Open in Google Maps
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-64 rounded border overflow-hidden group">
      <div ref={mapRef} className="absolute inset-0" />
      <div className="absolute bottom-2 right-2">
        <Button
          size="sm"
          variant="secondary"
          className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white shadow-sm"
          onClick={handleMapClick}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Open
        </Button>
      </div>
      {/* Address overlay for accessibility */}
      <div className="absolute top-2 left-2 bg-white/90 px-2 py-1 rounded text-xs text-gray-700 max-w-[200px] truncate opacity-0 group-hover:opacity-100 transition-opacity">
        {address}
      </div>
    </div>
  );
}
