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

    console.info(`Searching Whitney Museum for: ${artistName}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response;
    let html;
    
    try {
      // Whitney doesn't have a public API, but we can check their collection search
      const searchUrl = `https://whitney.org/collection/works?q=${encodeURIComponent(artistName)}`;
      
      response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ArtGalleryBot/1.0)',
          'Accept': 'text/html',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.info(`Whitney returned ${response.status} - returning empty results`);
        return new Response(
          JSON.stringify({ objects: [], totalObjects: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      html = await response.text();
    } catch (fetchError) {
      try { clearTimeout(timeoutId); } catch (_) { /* ignore */ }
      console.info('Whitney timeout or unavailable - returning empty results');
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0, note: 'Whitney temporarily unavailable' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the HTML to extract artwork information
    const objects: Array<{
      id: string;
      title: string;
      artist: string;
      date: string;
      medium: string;
      imageUrl: string | null;
      url: string;
    }> = [];

    // Look for result count in the page
    const countMatch = html.match(/(\d+)\s+results?/i);
    const totalCount = countMatch ? parseInt(countMatch[1]) : 0;

    // Look for artwork items in the HTML
    const artworkRegex = /<div[^>]*class="[^"]*work-item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
    let match;
    let index = 0;
    
    while ((match = artworkRegex.exec(html)) !== null && objects.length < 15) {
      const artworkHtml = match[1];
      
      // Extract title
      const titleMatch = artworkHtml.match(/<h\d[^>]*>([^<]+)<\/h\d>/i) ||
                        artworkHtml.match(/class="[^"]*title[^"]*"[^>]*>([^<]+)</i);
      const title = titleMatch ? titleMatch[1].trim() : null;
      
      // Extract artist
      const artistMatch = artworkHtml.match(/class="[^"]*artist[^"]*"[^>]*>([^<]+)</i);
      const artist = artistMatch ? artistMatch[1].trim() : artistName;
      
      // Extract date
      const dateMatch = artworkHtml.match(/(\d{4})/);
      const date = dateMatch ? dateMatch[1] : '';
      
      // Extract image
      const imgMatch = artworkHtml.match(/src="([^"]+)"/i);
      const imageUrl = imgMatch ? imgMatch[1] : null;
      
      // Extract URL
      const urlMatch = artworkHtml.match(/href="(\/collection\/works\/[^"]+)"/i);
      const url = urlMatch ? `https://whitney.org${urlMatch[1]}` : '';
      
      if (title) {
        objects.push({
          id: `whitney-${index++}`,
          title,
          artist,
          date,
          medium: '',
          imageUrl,
          url,
        });
      }
    }

    console.info(`Found ${objects.length} Whitney objects for ${artistName}`);

    return new Response(
      JSON.stringify({
        objects,
        totalObjects: totalCount || objects.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Whitney search error:', error);
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
