
import { useCallback } from 'react';

interface GeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
}

export function useGeocoding() {
  const geocodeAddress = useCallback(async (address: string): Promise<GeocodeResult> => {
    const encodedAddress = encodeURIComponent(address);
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
  }, []);

  return { geocodeAddress };
}
