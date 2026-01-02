import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
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

    const apiKey = Deno.env.get('DPLA_API_KEY');
    if (!apiKey) {
      console.error('DPLA_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'DPLA API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Searching DPLA for artist: ${artistName}`);

    // Search DPLA API - searching in creator field
    const searchUrl = `https://api.dp.la/v2/items?sourceResource.creator=${encodeURIComponent(artistName)}&page_size=${limit}&api_key=${apiKey}`;
    
    console.log(`DPLA API URL: ${searchUrl.replace(apiKey, 'REDACTED')}`);

    const response = await fetch(searchUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`DPLA API error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: `DPLA API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`DPLA returned ${data.count || 0} total results`);

    // Transform DPLA results to a consistent format
    const results = (data.docs || []).map((item: any) => {
      const sourceResource = item.sourceResource || {};
      
      return {
        id: item.id || item['@id'],
        title: Array.isArray(sourceResource.title) ? sourceResource.title[0] : sourceResource.title,
        artist: Array.isArray(sourceResource.creator) ? sourceResource.creator.join(', ') : sourceResource.creator,
        date: Array.isArray(sourceResource.date) 
          ? sourceResource.date[0]?.displayDate || sourceResource.date[0] 
          : sourceResource.date?.displayDate || sourceResource.date,
        medium: Array.isArray(sourceResource.type) ? sourceResource.type.join(', ') : sourceResource.type,
        description: Array.isArray(sourceResource.description) ? sourceResource.description[0] : sourceResource.description,
        imageUrl: item.object || null,
        thumbnailUrl: item.object || null,
        sourceUrl: item.isShownAt || null,
        collection: Array.isArray(sourceResource.collection?.title) 
          ? sourceResource.collection.title[0] 
          : sourceResource.collection?.title,
        provider: item.provider?.name,
        rights: sourceResource.rights,
        source: 'dpla'
      };
    });

    console.log(`Returning ${results.length} processed results`);

    return new Response(
      JSON.stringify({
        results,
        totalResults: data.count || 0,
        source: 'Digital Public Library of America'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in DPLA search:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
