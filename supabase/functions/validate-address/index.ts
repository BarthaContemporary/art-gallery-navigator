import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AddressSuggestion {
  place_id: string;
  formatted_address: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  lat?: number;
  lng?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!GOOGLE_MAPS_API_KEY) {
      console.error('GOOGLE_MAPS_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'Google Maps API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { input, action } = await req.json();

    if (action === 'autocomplete') {
      // Use the new Places API (New) endpoint
      const url = 'https://places.googleapis.com/v1/places:autocomplete';

      console.log('Fetching autocomplete suggestions for:', input);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        },
        body: JSON.stringify({
          input: input,
          includedPrimaryTypes: ['street_address', 'subpremise', 'premise', 'route'],
        }),
      });

      const data = await response.json();

      if (data.error) {
        console.error('Autocomplete API error:', data.error.message);
        return new Response(
          JSON.stringify({ error: data.error.message, status: data.error.status }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const suggestions = data.suggestions?.map((s: any) => ({
        place_id: s.placePrediction?.placeId,
        description: s.placePrediction?.text?.text || s.placePrediction?.structuredFormat?.mainText?.text,
      })).filter((s: any) => s.place_id) || [];

      return new Response(
        JSON.stringify({ suggestions }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'details') {
      // Use the new Places API (New) for place details
      const url = `https://places.googleapis.com/v1/places/${input}`;

      console.log('Fetching place details for:', input);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,addressComponents,location',
        },
      });

      const data = await response.json();

      if (data.error) {
        console.error('Place details API error:', data.error.message);
        return new Response(
          JSON.stringify({ error: data.error.message, status: data.error.status }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const components = data.addressComponents || [];

      const getComponent = (types: string[]) => {
        const component = components.find((c: any) => types.some(t => c.types.includes(t)));
        return component?.longText || '';
      };

      const streetNumber = getComponent(['street_number']);
      const route = getComponent(['route']);

      const address: AddressSuggestion = {
        place_id: input,
        formatted_address: data.formattedAddress || '',
        address_line1: [streetNumber, route].filter(Boolean).join(' '),
        address_line2: getComponent(['subpremise', 'floor', 'room']),
        city: getComponent(['locality', 'sublocality', 'postal_town']),
        state: getComponent(['administrative_area_level_1']),
        postal_code: getComponent(['postal_code']),
        country: getComponent(['country']),
        lat: data.location?.latitude,
        lng: data.location?.longitude,
      };

      return new Response(
        JSON.stringify({ address }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "autocomplete" or "details"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in validate-address:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
