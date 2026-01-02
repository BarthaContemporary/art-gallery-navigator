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

    console.log(`SMK (Denmark): Searching for artist: ${artistName}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // SMK API - Statens Museum for Kunst, Denmark
    const searchUrl = `https://api.smk.dk/api/v1/art/search/?keys=${encodeURIComponent(artistName)}&filters=[has_image:true]&offset=0&rows=50`;
    
    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`SMK API error: ${response.status}`);
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`SMK: Found ${data.found || 0} total records`);

    const objects = (data.items || []).map((record: any) => {
      const artist = record.production?.[0]?.creator || artistName;
      const imageUrl = record.image_thumbnail || (record.images?.[0]?.thumbnail);
      
      return {
        id: record.object_number || record.id,
        title: record.titles?.[0]?.title || record.title_first || 'Untitled',
        artist: artist,
        date: record.production?.[0]?.date_string || record.production_date?.[0]?.period || '',
        medium: record.techniques?.join(', ') || record.materials?.join(', ') || '',
        imageUrl: imageUrl || null,
        url: `https://open.smk.dk/artwork/image/${record.object_number}`,
        collection: 'Statens Museum for Kunst (SMK)'
      };
    });

    return new Response(
      JSON.stringify({ 
        objects, 
        totalObjects: data.found || objects.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('SMK search error:', error);
    return new Response(
      JSON.stringify({ objects: [], totalObjects: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
