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

    console.log(`British Museum: Searching for artist: ${artistName}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    // British Museum SPARQL endpoint
    const sparqlQuery = `
      PREFIX crm: <http://www.cidoc-crm.org/cidoc-crm/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
      
      SELECT DISTINCT ?object ?title ?maker ?date ?material ?thumbnail
      WHERE {
        ?object a crm:E22_Human-Made_Object .
        ?object rdfs:label ?title .
        ?object crm:P108i_was_produced_by ?production .
        ?production crm:P14_carried_out_by ?makerEntity .
        ?makerEntity rdfs:label ?maker .
        FILTER(CONTAINS(LCASE(?maker), LCASE("${artistName}")))
        OPTIONAL { ?object crm:P45_consists_of/rdfs:label ?material }
        OPTIONAL { ?production crm:P4_has_time-span/rdfs:label ?date }
        OPTIONAL { ?object crm:P138i_has_representation ?thumbnail }
      }
      LIMIT 50
    `;

    const response = await fetch('https://collection.britishmuseum.org/sparql', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Accept': 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `query=${encodeURIComponent(sparqlQuery)}`
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`British Museum SPARQL error: ${response.status}`);
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const bindings = data.results?.bindings || [];
    console.log(`British Museum: Found ${bindings.length} records`);

    const objects = bindings.map((binding: any) => {
      const objectUri = binding.object?.value || '';
      const id = objectUri.split('/').pop() || objectUri;
      
      return {
        id: id,
        title: binding.title?.value || 'Untitled',
        artist: binding.maker?.value || artistName,
        date: binding.date?.value || '',
        medium: binding.material?.value || '',
        imageUrl: binding.thumbnail?.value || null,
        url: objectUri || `https://collection.britishmuseum.org/resource/${id}`,
        collection: 'British Museum'
      };
    });

    return new Response(
      JSON.stringify({ 
        objects, 
        totalObjects: objects.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('British Museum search error:', error);
    return new Response(
      JSON.stringify({ objects: [], totalObjects: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
