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

    console.info(`Searching Guggenheim for: ${artistName}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response;
    let html;
    
    try {
      // Guggenheim doesn't have a public API, but we can scrape their collection search
      const searchUrl = `https://www.guggenheim.org/collection/search?artist=${encodeURIComponent(artistName)}`;
      
      response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ArtGalleryBot/1.0)',
          'Accept': 'text/html',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.info(`Guggenheim returned ${response.status} - returning empty results`);
        return new Response(
          JSON.stringify({ objects: [], totalObjects: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      html = await response.text();
    } catch (fetchError) {
      try { clearTimeout(timeoutId); } catch (_) { /* ignore */ }
      console.info('Guggenheim timeout or unavailable - returning empty results');
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0, note: 'Guggenheim temporarily unavailable' }),
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

    // Look for artwork cards in the HTML
    const artworkRegex = /<article[^>]*class="[^"]*artwork[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
    let match;
    let index = 0;
    
    while ((match = artworkRegex.exec(html)) !== null && objects.length < 15) {
      const artworkHtml = match[1];
      
      // Extract title
      const titleMatch = artworkHtml.match(/<h\d[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/h\d>/i) ||
                        artworkHtml.match(/data-title="([^"]+)"/i);
      const title = titleMatch ? titleMatch[1].trim() : null;
      
      // Extract artist
      const artistMatch = artworkHtml.match(/<span[^>]*class="[^"]*artist[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                         artworkHtml.match(/data-artist="([^"]+)"/i);
      const artist = artistMatch ? artistMatch[1].trim() : null;
      
      // Extract date
      const dateMatch = artworkHtml.match(/<span[^>]*class="[^"]*date[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                       artworkHtml.match(/data-date="([^"]+)"/i);
      const date = dateMatch ? dateMatch[1].trim() : '';
      
      // Extract image
      const imgMatch = artworkHtml.match(/src="([^"]+)"/i) ||
                      artworkHtml.match(/data-src="([^"]+)"/i);
      const imageUrl = imgMatch ? imgMatch[1] : null;
      
      // Extract URL
      const urlMatch = artworkHtml.match(/href="(\/artwork\/[^"]+)"/i);
      const url = urlMatch ? `https://www.guggenheim.org${urlMatch[1]}` : '';
      
      if (title) {
        objects.push({
          id: `guggenheim-${index++}`,
          title,
          artist: artist || artistName,
          date,
          medium: '',
          imageUrl,
          url,
        });
      }
    }

    console.info(`Found ${objects.length} Guggenheim objects for ${artistName}`);

    return new Response(
      JSON.stringify({
        objects,
        totalObjects: objects.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Guggenheim search error:', error);
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
