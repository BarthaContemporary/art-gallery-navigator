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
    const { artistName, limit = 20 } = await req.json();

    if (!artistName) {
      return new Response(
        JSON.stringify({ error: 'Artist name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('SMITHSONIAN_API_KEY');
    if (!apiKey) {
      console.error('SMITHSONIAN_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Smithsonian API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Searching Smithsonian for artist: ${artistName}`);

    // Search Smithsonian Open Access API
    const searchUrl = `https://api.si.edu/openaccess/api/v1.0/search?q=name:${encodeURIComponent(artistName)}&rows=${limit}&api_key=${apiKey}`;
    
    console.log(`Smithsonian API URL: ${searchUrl.replace(apiKey, 'REDACTED')}`);

    const response = await fetch(searchUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Smithsonian API error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: `Smithsonian API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`Smithsonian returned ${data.response?.rowCount || 0} total results`);

    // Transform results to a consistent format
    const results = (data.response?.rows || []).map((item: any) => {
      const content = item.content || {};
      const descriptiveNonRepeating = content.descriptiveNonRepeating || {};
      const freetext = content.freetext || {};
      const indexedStructured = content.indexedStructured || {};
      
      // Get artist/creator name
      const creators = freetext.name?.find((n: any) => n.label === 'Artist' || n.label === 'Creator')?.content 
        || indexedStructured.name?.[0] 
        || '';
      
      // Get image URL
      const mediaItem = descriptiveNonRepeating.online_media?.media?.[0];
      const imageUrl = mediaItem?.content || mediaItem?.thumbnail || null;
      
      return {
        id: item.id,
        title: descriptiveNonRepeating.title?.content || content.title || 'Untitled',
        artist: creators,
        date: freetext.date?.[0]?.content || indexedStructured.date?.[0] || '',
        medium: freetext.physicalDescription?.[0]?.content || '',
        description: freetext.notes?.[0]?.content || '',
        imageUrl: imageUrl,
        thumbnailUrl: imageUrl,
        sourceUrl: descriptiveNonRepeating.record_link || descriptiveNonRepeating.guid || null,
        collection: descriptiveNonRepeating.data_source || '',
        unitCode: descriptiveNonRepeating.unit_code || '',
        source: 'smithsonian'
      };
    });

    console.log(`Returning ${results.length} processed results`);

    return new Response(
      JSON.stringify({
        results,
        totalResults: data.response?.rowCount || 0,
        source: 'Smithsonian Institution'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in Smithsonian search:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
