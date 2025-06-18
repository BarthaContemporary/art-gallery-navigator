
interface MapLoadingDisplayProps {
  address: string;
  formatAddressForGeocoding: (address: string) => string;
}

export function MapLoadingDisplay({ address, formatAddressForGeocoding }: MapLoadingDisplayProps) {
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
