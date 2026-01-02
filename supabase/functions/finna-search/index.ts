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

    console.log(`Finna (Finland): Searching for artist: ${artistName}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // Finna API - Finnish museums/libraries/archives aggregation
    const searchUrl = `https://api.finna.fi/api/v1/search?lookfor=${encodeURIComponent(artistName)}&type=Author&filter[]=~format_ext_str_mv:0/Image/&limit=50&lng=en`;
    
    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Finna API error: ${response.status}`);
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`Finna: Found ${data.resultCount || 0} total records`);

    const objects = (data.records || []).map((record: any) => {
      const imageUrl = record.images?.[0] 
        ? `https://finna.fi${record.images[0]}`
        : null;
      
      return {
        id: record.id,
        title: record.title || 'Untitled',
        artist: record.nonPresenterAuthors?.[0]?.name || record.authors?.primary?.[Object.keys(record.authors?.primary || {})[0]] || artistName,
        date: record.year || record.publicationDates?.[0] || '',
        medium: record.formats?.[0]?.translated || record.physicalDescriptions?.[0] || '',
        imageUrl: imageUrl,
        url: `https://finna.fi/Record/${encodeURIComponent(record.id)}`,
        collection: record.buildings?.[0]?.translated || 'Finna (Finland)'
      };
    });

    return new Response(
      JSON.stringify({ 
        objects, 
        totalObjects: data.resultCount || objects.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Finna search error:', error);
    return new Response(
      JSON.stringify({ objects: [], totalObjects: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
