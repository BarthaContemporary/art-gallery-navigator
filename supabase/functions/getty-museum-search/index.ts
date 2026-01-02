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

    console.log(`Getty Museum: Searching for artist: ${artistName}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // Getty uses a search endpoint
    const searchUrl = `https://data.getty.edu/museum/collection/search?q=${encodeURIComponent(artistName)}&type=HumanMadeObject&rows=50`;
    
    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Getty Museum API error: ${response.status}`);
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`Getty Museum: Found ${data.response?.numFound || 0} total records`);

    const objects = (data.response?.docs || []).map((record: any) => {
      const id = record.id?.split('/').pop() || record.id;
      return {
        id: id,
        title: record.title || record._primaryTitle || 'Untitled',
        artist: record.producedBy?.map((p: any) => p.label || p).join(', ') || artistName,
        date: record.date || record.producedDate || '',
        medium: record.material?.join(', ') || record.technique?.join(', ') || '',
        imageUrl: record.thumbnail || null,
        url: `https://www.getty.edu/art/collection/object/${id}`,
        collection: 'J. Paul Getty Museum'
      };
    });

    return new Response(
      JSON.stringify({ 
        objects, 
        totalObjects: data.response?.numFound || objects.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Getty Museum search error:', error);
    return new Response(
      JSON.stringify({ objects: [], totalObjects: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
