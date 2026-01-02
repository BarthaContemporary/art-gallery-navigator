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

    const apiKey = Deno.env.get('EUROPEANA_API_KEY');
    if (!apiKey) {
      console.error('Europeana API key not configured');
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Europeana: Searching for artist: ${artistName}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // Europeana Search API - search for creator/artist
    const searchUrl = `https://api.europeana.eu/record/v2/search.json?wskey=${apiKey}&query=who:${encodeURIComponent(artistName)}&qf=TYPE:IMAGE&rows=50&profile=standard`;
    
    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Europeana API error: ${response.status}`);
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`Europeana: Found ${data.totalResults || 0} total records`);

    const objects = (data.items || []).map((record: any) => {
      // Get best available image
      const imageUrl = record.edmPreview?.[0] || 
                       record.edmIsShownBy?.[0] || 
                       null;
      
      // Extract provider/institution
      const provider = record.dataProvider?.[0] || record.provider?.[0] || 'Europeana';
      
      return {
        id: record.id || record.guid,
        title: record.title?.[0] || record.dcTitleLangAware?.en?.[0] || 'Untitled',
        artist: record.dcCreator?.[0] || record.dcCreatorLangAware?.en?.[0] || artistName,
        date: record.year?.[0] || record.dcDate?.[0] || '',
        medium: record.dcType?.[0] || record.dcTypeLangAware?.en?.[0] || '',
        imageUrl: imageUrl,
        url: record.guid || `https://www.europeana.eu/item${record.id}`,
        collection: provider
      };
    });

    return new Response(
      JSON.stringify({ 
        objects, 
        totalObjects: data.totalResults || objects.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Europeana search error:', error);
    return new Response(
      JSON.stringify({ objects: [], totalObjects: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
