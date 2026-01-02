import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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

    console.log(`Searching Neuberger Museum for artist: ${artistName}`);

    // Neuberger Museum uses a WordPress-based site with collection search
    const searchQuery = encodeURIComponent(artistName);
    const searchUrl = `https://www.neuberger.org/?s=${searchQuery}&post_type=artwork`;

    console.log('Fetching from:', searchUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Neuberger Museum returned status: ${response.status}`);
      return new Response(
        JSON.stringify({ objects: [], message: 'Museum search unavailable' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();
    console.log(`Received ${html.length} bytes of HTML`);

    const objects: Array<{
      id: string;
      title: string;
      artist: string;
      date?: string;
      medium?: string;
      url: string;
      imageUrl?: string;
      location: string;
    }> = [];

    // Try to find artwork entries in search results
    // Look for article or entry patterns typical of WordPress collection sites
    const articlePattern = /<article[^>]*class="[^"]*artwork[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
    const linkPattern = /<a[^>]*href="([^"]*\/artwork\/[^"]*)"[^>]*>/gi;
    const imgPattern = /<img[^>]*src="([^"]+)"[^>]*>/i;
    const titlePattern = /<h[1-4][^>]*>([^<]+)<\/h[1-4]>/i;

    // First try to find article blocks
    let match;
    while ((match = articlePattern.exec(html)) !== null && objects.length < 20) {
      const articleHtml = match[1];
      
      const linkMatch = /<a[^>]*href="([^"]+)"[^>]*>/i.exec(articleHtml);
      const titleMatch = titlePattern.exec(articleHtml);
      const imgMatch = imgPattern.exec(articleHtml);

      if (linkMatch && titleMatch) {
        const url = linkMatch[1];
        const title = titleMatch[1].trim();
        
        objects.push({
          id: `neuberger-${objects.length + 1}`,
          title,
          artist: artistName,
          url: url.startsWith('http') ? url : `https://www.neuberger.org${url}`,
          imageUrl: imgMatch ? imgMatch[1] : undefined,
          location: 'Neuberger Museum of Art, Purchase, NY',
        });
      }
    }

    // If no articles found, try simpler link extraction
    if (objects.length === 0) {
      while ((match = linkPattern.exec(html)) !== null && objects.length < 20) {
        const url = match[1];
        
        // Try to extract title from URL
        const urlParts = url.split('/');
        const slug = urlParts[urlParts.length - 2] || urlParts[urlParts.length - 1];
        const title = slug
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());

        if (!objects.some(o => o.url === url)) {
          objects.push({
            id: `neuberger-${objects.length + 1}`,
            title,
            artist: artistName,
            url: url.startsWith('http') ? url : `https://www.neuberger.org${url}`,
            location: 'Neuberger Museum of Art, Purchase, NY',
          });
        }
      }
    }

    console.log(`Found ${objects.length} artworks from Neuberger Museum`);

    return new Response(
      JSON.stringify({ objects }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error searching Neuberger Museum:', error);
    
    if (error.name === 'AbortError') {
      return new Response(
        JSON.stringify({ objects: [], message: 'Search timed out' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ objects: [], error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
