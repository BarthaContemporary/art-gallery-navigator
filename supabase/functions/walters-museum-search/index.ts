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

    console.log(`Walters Museum: Searching for artist: ${artistName}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const searchUrl = `https://api.thewalters.org/v1/objects?creator=${encodeURIComponent(artistName)}&pageSize=50`;
    
    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Walters Museum API error: ${response.status}`);
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`Walters Museum: Found ${data.ReturnInfo?.Count || 0} total records`);

    const objects = (data.Items || []).map((record: any) => ({
      id: record.ObjectID?.toString() || record.ObjectNumber,
      title: record.Title || 'Untitled',
      artist: record.Creator || artistName,
      date: record.DateText || record.DateBeginYear?.toString() || '',
      medium: record.Medium || record.Classification || '',
      imageUrl: record.PrimaryImage?.Medium || record.PrimaryImage?.Small || null,
      url: `https://art.thewalters.org/detail/${record.ObjectID}`,
      collection: 'Walters Art Museum'
    }));

    return new Response(
      JSON.stringify({ 
        objects, 
        totalObjects: data.ReturnInfo?.Count || objects.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Walters Museum search error:', error);
    return new Response(
      JSON.stringify({ objects: [], totalObjects: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
