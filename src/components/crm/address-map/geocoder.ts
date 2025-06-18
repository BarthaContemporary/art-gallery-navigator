
import { LocationData } from "./mapState";
import { MapError, MAP_ERROR_CODES, createMapError } from "./mapErrors";
import { formatAddressForGeocoding } from "./utils";
import { supabase } from "@/integrations/supabase/client";

export class AddressGeocoder {
  async geocodeAddress(address: string): Promise<LocationData> {
    const formattedAddress = formatAddressForGeocoding(address);
    console.log('Geocoding address:', formattedAddress);

    try {
      const { data, error } = await supabase.functions.invoke('geocode', {
        body: { address: formattedAddress }
      });

      if (error) {
        throw createMapError(
          MAP_ERROR_CODES.GEOCODING_FAILED,
          'Geocoding service error',
          { error: error.message }
        );
      }

      if (data.error) {
        if (data.error.includes('not found')) {
          throw createMapError(
            MAP_ERROR_CODES.ADDRESS_NOT_FOUND,
            'Address not found',
            { address: formattedAddress }
          );
        }
        throw createMapError(
          MAP_ERROR_CODES.GEOCODING_FAILED,
          data.error,
          { address: formattedAddress }
        );
      }

      if (!data.results || data.results.length === 0) {
        throw createMapError(
          MAP_ERROR_CODES.ADDRESS_NOT_FOUND,
          'No results found for address',
          { address: formattedAddress }
        );
      }

      const result = data.results[0];
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formatted_address: result.formatted_address
      };
    } catch (err) {
      if (err instanceof MapError) {
        throw err;
      }
      throw createMapError(
        MAP_ERROR_CODES.GEOCODING_FAILED,
        'Geocoding request failed',
        { originalError: err }
      );
    }
  }
}
