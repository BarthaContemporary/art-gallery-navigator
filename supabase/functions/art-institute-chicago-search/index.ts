import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

interface AICObject {
  id: number;
  title: string;
  artist_display: string;
  date_display: string;
  medium_display: string;
  thumbnail: { lqip: string; width: number; height: number; alt_text: string } | null;
  image_id: string | null;
  department_title: string;
}

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

    console.info(`Searching Art Institute of Chicago for: ${artistName}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response;
    let data;
    
    try {
      // Art Institute of Chicago has an excellent public API
      const searchUrl = `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(artistName)}&query[term][artist_title]=${encodeURIComponent(artistName)}&limit=15&fields=id,title,artist_display,date_display,medium_display,thumbnail,image_id,department_title`;
      
      response = await fetch(searchUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.info(`AIC API returned ${response.status} - returning empty results`);
        return new Response(
          JSON.stringify({ objects: [], totalObjects: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      data = await response.json();
    } catch (fetchError) {
      try { clearTimeout(timeoutId); } catch (_) { /* ignore */ }
      console.info('Art Institute of Chicago API timeout or unavailable - returning empty results');
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0, note: 'AIC API temporarily unavailable' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!data.data || data.data.length === 0) {
      console.info(`No AIC objects found for: ${artistName}`);
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter for exact artist matches and format response
    const artistNameLower = artistName.toLowerCase();
    const objects = data.data
      .filter((obj: AICObject) => 
        obj.artist_display && obj.artist_display.toLowerCase().includes(artistNameLower.split(' ')[0])
      )
      .map((obj: AICObject) => ({
        id: obj.id,
        title: obj.title || 'Untitled',
        artistDisplay: obj.artist_display || '',
        dateDisplay: obj.date_display || '',
        medium: obj.medium_display || '',
        imageUrl: obj.image_id 
          ? `https://www.artic.edu/iiif/2/${obj.image_id}/full/400,/0/default.jpg`
          : null,
        thumbnailUrl: obj.thumbnail?.lqip || null,
        department: obj.department_title || '',
        url: `https://www.artic.edu/artworks/${obj.id}`,
      }));

    console.info(`Found ${objects.length} AIC objects for ${artistName}`);

    return new Response(
      JSON.stringify({
        objects,
        totalObjects: data.pagination?.total || objects.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Art Institute of Chicago search error:', error);
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
