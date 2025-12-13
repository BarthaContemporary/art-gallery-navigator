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

    console.info(`Searching National Gallery London for: ${artistName}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response;
    let data;
    
    try {
      // National Gallery London SPARQL endpoint
      const sparqlQuery = `
        PREFIX dc: <http://purl.org/dc/elements/1.1/>
        PREFIX dct: <http://purl.org/dc/terms/>
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        
        SELECT ?artwork ?title ?artist ?date ?medium ?image WHERE {
          ?artwork dc:creator ?artistUri .
          ?artistUri foaf:name ?artist .
          ?artwork dc:title ?title .
          OPTIONAL { ?artwork dct:date ?date }
          OPTIONAL { ?artwork dct:medium ?medium }
          OPTIONAL { ?artwork foaf:depiction ?image }
          FILTER(CONTAINS(LCASE(?artist), LCASE("${artistName.split(' ')[0]}")))
        }
        LIMIT 15
      `;
      
      response = await fetch('https://sparql.nationalgallery.org.uk/sparql.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/sparql-results+json',
        },
        body: `query=${encodeURIComponent(sparqlQuery)}`,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.info(`National Gallery API returned ${response.status} - returning empty results`);
        return new Response(
          JSON.stringify({ objects: [], totalObjects: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      data = await response.json();
    } catch (fetchError) {
      try { clearTimeout(timeoutId); } catch (_) { /* ignore */ }
      console.info('National Gallery API timeout or unavailable - returning empty results');
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0, note: 'National Gallery API temporarily unavailable' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!data.results?.bindings || data.results.bindings.length === 0) {
      console.info(`No National Gallery objects found for: ${artistName}`);
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format response
    const objects = data.results.bindings.map((binding: any, index: number) => ({
      id: binding.artwork?.value?.split('/').pop() || `ng-${index}`,
      title: binding.title?.value || 'Untitled',
      artist: binding.artist?.value || '',
      date: binding.date?.value || '',
      medium: binding.medium?.value || '',
      imageUrl: binding.image?.value || null,
      url: binding.artwork?.value || null,
    }));

    console.info(`Found ${objects.length} National Gallery objects for ${artistName}`);

    return new Response(
      JSON.stringify({
        objects,
        totalObjects: objects.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('National Gallery search error:', error);
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
