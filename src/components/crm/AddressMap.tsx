
import { useEffect, useRef, useState } from "react";
import { MapPin, ExternalLink } from "lucide-react";
import { Loader } from "@googlemaps/js-api-loader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AddressMapProps {
  address: string;
  clientName: string;
}

export function AddressMap({ address, clientName }: AddressMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializeMap = async (googleApiKey: string) => {
    if (!mapRef.current || !address) return;

    setIsLoading(true);
    setError(null);

    try {
      const loader = new Loader({
        apiKey: googleApiKey,
        version: "weekly",
        libraries: ["places", "geometry"]
      });

      const google = await loader.load();
      
      // Initialize map
      const mapInstance = new google.maps.Map(mapRef.current, {
        zoom: 15,
        center: { lat: 0, lng: 0 },
        mapTypeControl: false,
        streetViewControl: true,
        fullscreenControl: true,
      });

      // Geocode the address
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const location = results[0].geometry.location;
          mapInstance.setCenter(location);
          
          // Add marker
          new google.maps.Marker({
            position: location,
            map: mapInstance,
            title: clientName,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#3B82F6",
              fillOpacity: 1,
              strokeColor: "#FFFFFF",
              strokeWeight: 2,
            },
          });

          // Add info window
          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="padding: 8px; max-width: 200px;">
                <h3 style="margin: 0 0 4px 0; font-weight: 600;">${clientName}</h3>
                <p style="margin: 0; font-size: 12px; color: #666;">${address}</p>
              </div>
            `,
          });

          const marker = new google.maps.Marker({
            position: location,
            map: mapInstance,
            title: clientName,
          });

          marker.addListener("click", () => {
            infoWindow.open(mapInstance, marker);
          });

          setMap(mapInstance);
        } else {
          setError("Could not find location for this address");
        }
      });
    } catch (err) {
      setError("Failed to load Google Maps");
      console.error("Google Maps error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApiKeySubmit = () => {
    if (apiKey.trim()) {
      localStorage.setItem('googleMapsApiKey', apiKey);
      initializeMap(apiKey);
      setShowApiKeyInput(false);
    }
  };

  useEffect(() => {
    const savedApiKey = localStorage.getItem('googleMapsApiKey');
    if (savedApiKey) {
      setApiKey(savedApiKey);
      initializeMap(savedApiKey);
    } else {
      setShowApiKeyInput(true);
    }
  }, [address]);

  const handleMapClick = () => {
    if (address) {
      const encodedAddress = encodeURIComponent(address);
      const mapUrl = `https://maps.google.com/maps?q=${encodedAddress}`;
      window.open(mapUrl, '_blank');
    }
  };

  if (showApiKeyInput) {
    return (
      <div className="relative w-full h-48 bg-gray-50 rounded border p-4 flex flex-col justify-center">
        <div className="text-center space-y-3">
          <MapPin className="h-8 w-8 mx-auto text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Enter Google Maps API Key
            </p>
            <p className="text-xs text-gray-500 mb-3">
              Get your API key from{" "}
              <a 
                href="https://console.cloud.google.com/google/maps-apis" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Google Cloud Console
              </a>
            </p>
            <div className="flex gap-2 max-w-sm mx-auto">
              <Input
                type="password"
                placeholder="API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="text-xs"
              />
              <Button size="sm" onClick={handleApiKeySubmit}>
                Load Map
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="relative w-full h-48 bg-gray-50 rounded border flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-xs text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative w-full h-48 bg-gray-50 rounded border p-4 flex flex-col justify-center">
        <div className="text-center space-y-2">
          <MapPin className="h-6 w-6 mx-auto text-red-400" />
          <p className="text-xs text-red-600">{error}</p>
          <div className="flex justify-center gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setShowApiKeyInput(true)}
            >
              Change API Key
            </Button>
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
    <div className="relative w-full h-48 rounded border overflow-hidden group">
      <div ref={mapRef} className="absolute inset-0" />
      <div className="absolute bottom-2 right-2">
        <Button
          size="sm"
          variant="secondary"
          className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white"
          onClick={handleMapClick}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Open
        </Button>
      </div>
    </div>
  );
}
