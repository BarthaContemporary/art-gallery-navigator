import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { artistName } = await req.json();

    if (!artistName) {
      return new Response(
        JSON.stringify({ error: 'Artist name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.info(`Searching Artsy for: ${artistName}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // First, get authentication token
    const clientId = Deno.env.get('ARTSY_CLIENT_ID');
    const clientSecret = Deno.env.get('ARTSY_CLIENT_SECRET');
    
    // If no API keys, return empty (Artsy requires auth for most endpoints)
    if (!clientId || !clientSecret) {
      console.info('Artsy API credentials not configured - returning empty results');
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0, note: 'Artsy API not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let tokenResponse;
    let tokenData;
    
    try {
      tokenResponse = await fetch('https://api.artsy.net/api/tokens/xapp_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
        }),
        signal: controller.signal,
      });
      
      if (!tokenResponse.ok) {
        console.info('Failed to get Artsy token - returning empty results');
        clearTimeout(timeoutId);
        return new Response(
          JSON.stringify({ objects: [], totalObjects: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      tokenData = await tokenResponse.json();
    } catch (fetchError) {
      try { clearTimeout(timeoutId); } catch (_) { /* ignore */ }
      console.info('Artsy API timeout - returning empty results');
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0, note: 'Artsy API temporarily unavailable' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const xappToken = tokenData.token;

    // Search for artist
    let artistResponse;
    let artistData;
    
    try {
      artistResponse = await fetch(
        `https://api.artsy.net/api/search?q=${encodeURIComponent(artistName)}&type=artist&size=5`,
        {
          headers: {
            'X-Xapp-Token': xappToken,
            'Accept': 'application/vnd.artsy-v2+json',
          },
          signal: controller.signal,
        }
      );
      
      if (!artistResponse.ok) {
        clearTimeout(timeoutId);
        return new Response(
          JSON.stringify({ objects: [], totalObjects: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      artistData = await artistResponse.json();
    } catch (fetchError) {
      try { clearTimeout(timeoutId); } catch (_) { /* ignore */ }
      console.info('Artsy artist search timeout - returning empty results');
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    clearTimeout(timeoutId);

    if (!artistData._embedded?.results || artistData._embedded.results.length === 0) {
      console.info(`No Artsy artists found for: ${artistName}`);
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format artist results
    const artists = artistData._embedded.results.map((artist: any) => ({
      id: artist._links?.self?.href?.split('/').pop() || artist.title,
      name: artist.title || '',
      description: artist.description || '',
      thumbnailUrl: artist._links?.thumbnail?.href || null,
      url: artist._links?.permalink?.href || null,
    }));

    console.info(`Found ${artists.length} Artsy artists for ${artistName}`);

    return new Response(
      JSON.stringify({
        objects: artists,
        totalObjects: artists.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Artsy search error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        objects: [],
        totalObjects: 0,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
