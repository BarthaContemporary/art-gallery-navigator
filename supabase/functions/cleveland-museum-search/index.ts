import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    console.log(`Cleveland Museum: Searching for artist: ${artistName}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const searchUrl = `https://openaccess-api.clevelandart.org/api/artworks/?artists=${encodeURIComponent(artistName)}&has_image=1&limit=50`;
    
    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Cleveland Museum API error: ${response.status}`);
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`Cleveland Museum: Found ${data.info?.total || 0} total records`);

    const objects = (data.data || []).map((record: any) => ({
      id: record.id?.toString() || record.accession_number,
      title: record.title || 'Untitled',
      artist: record.creators?.map((c: any) => c.description).join(', ') || artistName,
      date: record.creation_date || record.creation_date_earliest?.toString() || '',
      medium: record.technique || record.type || '',
      imageUrl: record.images?.web?.url || null,
      url: record.url || `https://www.clevelandart.org/art/${record.id}`,
      collection: 'Cleveland Museum of Art'
    }));

    return new Response(
      JSON.stringify({ 
        objects, 
        totalObjects: data.info?.total || objects.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Cleveland Museum search error:', error);
    return new Response(
      JSON.stringify({ objects: [], totalObjects: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
