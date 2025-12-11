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
      // Get address suggestions
      const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
      url.searchParams.set('input', input);
      url.searchParams.set('types', 'address');
      url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

      console.log('Fetching autocomplete suggestions for:', input);

      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error('Autocomplete API error:', data.status, data.error_message);
        return new Response(
          JSON.stringify({ error: data.error_message || 'Autocomplete failed', status: data.status }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const suggestions = data.predictions?.map((p: any) => ({
        place_id: p.place_id,
        description: p.description,
      })) || [];

      return new Response(
        JSON.stringify({ suggestions }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'details') {
      // Get place details
      const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
      url.searchParams.set('place_id', input);
      url.searchParams.set('fields', 'address_components,formatted_address,geometry');
      url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

      console.log('Fetching place details for:', input);

      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.status !== 'OK') {
        console.error('Place details API error:', data.status, data.error_message);
        return new Response(
          JSON.stringify({ error: data.error_message || 'Failed to get place details', status: data.status }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = data.result;
      const components = result.address_components || [];

      const getComponent = (types: string[]) => {
        const component = components.find((c: any) => types.some(t => c.types.includes(t)));
        return component?.long_name || '';
      };

      const getComponentShort = (types: string[]) => {
        const component = components.find((c: any) => types.some(t => c.types.includes(t)));
        return component?.short_name || '';
      };

      const streetNumber = getComponent(['street_number']);
      const route = getComponent(['route']);

      const address: AddressSuggestion = {
        place_id: input,
        formatted_address: result.formatted_address || '',
        address_line1: [streetNumber, route].filter(Boolean).join(' '),
        address_line2: getComponent(['subpremise', 'floor', 'room']),
        city: getComponent(['locality', 'sublocality', 'postal_town']),
        state: getComponent(['administrative_area_level_1']),
        postal_code: getComponent(['postal_code']),
        country: getComponent(['country']),
        lat: result.geometry?.location?.lat,
        lng: result.geometry?.location?.lng,
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
