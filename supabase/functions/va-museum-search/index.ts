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

    console.log(`V&A Museum: Searching for artist: ${artistName}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const searchUrl = `https://api.vam.ac.uk/v2/objects/search?q_actor=${encodeURIComponent(artistName)}&page_size=50&images_exist=true`;
    
    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`V&A API error: ${response.status}`);
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`V&A Museum: Found ${data.info?.record_count || 0} total records`);

    const objects = (data.records || []).map((record: any) => {
      const primaryImage = record._images?._primary_thumbnail || record._images?._iiif_image_base_url;
      
      return {
        id: record.systemNumber || record.accessionNumber,
        title: record._primaryTitle || record.objectType || 'Untitled',
        artist: record._primaryMaker?.name || artistName,
        date: record._primaryDate || record.productionDates?.[0]?.date?.text || '',
        medium: record.materials?.map((m: any) => m.text).join(', ') || record.materialsAndTechniques || '',
        imageUrl: primaryImage ? (primaryImage.startsWith('http') ? primaryImage : `https://framemark.vam.ac.uk/collections/${primaryImage}/full/!400,400/0/default.jpg`) : null,
        url: `https://collections.vam.ac.uk/item/${record.systemNumber}`,
        collection: 'Victoria and Albert Museum'
      };
    });

    return new Response(
      JSON.stringify({ 
        objects, 
        totalObjects: data.info?.record_count || objects.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('V&A Museum search error:', error);
    return new Response(
      JSON.stringify({ objects: [], totalObjects: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
