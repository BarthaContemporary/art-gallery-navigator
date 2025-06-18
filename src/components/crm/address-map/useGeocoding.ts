
import { supabase } from "@/integrations/supabase/client";
import { LocationData } from "./types";
import { formatAddressForGeocoding } from "./utils";

export const useGeocoding = () => {
  const geocodeAddress = async (addressToGeocode: string): Promise<LocationData> => {
    const formattedAddress = formatAddressForGeocoding(addressToGeocode);
    
    console.log('Original address:', addressToGeocode);
    console.log('Formatted address for geocoding:', formattedAddress);
    
    try {
      const { data, error } = await supabase.functions.invoke('geocode', {
        body: { address: formattedAddress }
      });
      
      if (error) {
        console.error('Geocoding error:', error);
        throw new Error('Geocoding service unavailable');
      }
      
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
    } catch (err) {
      console.error('Geocoding failed:', err);
      throw err;
    }
  };

  return { geocodeAddress };
};
