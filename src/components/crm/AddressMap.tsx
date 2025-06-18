
import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";

interface AddressMapProps {
  address: string;
  clientName: string;
}

export function AddressMap({ address, clientName }: AddressMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  const handleMapClick = () => {
    // Open in default map application
    const encodedAddress = encodeURIComponent(address);
    const mapUrl = `https://maps.google.com/maps?q=${encodedAddress}`;
    window.open(mapUrl, '_blank');
  };

  // For now, we'll show a placeholder with the address
  // In a real implementation, you'd integrate with a mapping service
  return (
    <div 
      className="relative w-full h-24 bg-gray-100 rounded border cursor-pointer hover:bg-gray-50 transition-colors group"
      onClick={handleMapClick}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <MapPin className="h-6 w-6 mx-auto text-gray-600 group-hover:text-primary transition-colors" />
          <p className="text-xs text-gray-600 mt-1 px-2 line-clamp-2">
            {address}
          </p>
        </div>
      </div>
      <div className="absolute bottom-1 right-1 text-xs text-gray-400">
        Click to open
      </div>
    </div>
  );
}
