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

    console.log(`Searching Buffalo AKG Art Museum for artist: ${artistName}`);

    // Buffalo AKG (formerly Albright-Knox) has a collection search
    const searchQuery = encodeURIComponent(artistName);
    const searchUrl = `https://buffaloakg.org/art/collection?search=${searchQuery}`;

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
      console.error(`Buffalo AKG returned status: ${response.status}`);
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

    // Look for artwork cards/entries in the collection page
    // Pattern for collection item links
    const artworkLinkPattern = /<a[^>]*href="(\/art\/collection\/[^"]+)"[^>]*>/gi;
    const cardPattern = /<div[^>]*class="[^"]*(?:card|artwork|collection-item)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
    const imgPattern = /<img[^>]*(?:src|data-src)="([^"]+)"[^>]*>/i;
    const titlePattern = /<(?:h[1-6]|span|div)[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)</i;
    const artistPattern = /<(?:span|div|p)[^>]*class="[^"]*artist[^"]*"[^>]*>([^<]+)</i;
    const datePattern = /(\d{4})/;

    // Try to find card-style entries first
    let match;
    while ((match = cardPattern.exec(html)) !== null && objects.length < 20) {
      const cardHtml = match[1];
      
      const linkMatch = /<a[^>]*href="([^"]+)"[^>]*>/i.exec(cardHtml);
      const imgMatch = imgPattern.exec(cardHtml);
      const titleMatch = titlePattern.exec(cardHtml);
      
      if (linkMatch) {
        const url = linkMatch[1];
        let title = titleMatch ? titleMatch[1].trim() : '';
        
        // Extract title from URL if not found in HTML
        if (!title && url.includes('/collection/')) {
          const urlParts = url.split('/');
          const slug = urlParts[urlParts.length - 1];
          title = slug
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
        }

        if (title) {
          const dateMatch = datePattern.exec(cardHtml);
          
          objects.push({
            id: `akg-${objects.length + 1}`,
            title,
            artist: artistName,
            date: dateMatch ? dateMatch[1] : undefined,
            url: url.startsWith('http') ? url : `https://buffaloakg.org${url}`,
            imageUrl: imgMatch ? (imgMatch[1].startsWith('http') ? imgMatch[1] : `https://buffaloakg.org${imgMatch[1]}`) : undefined,
            location: 'Buffalo AKG Art Museum, Buffalo, NY',
          });
        }
      }
    }

    // Fallback: extract artwork links directly
    if (objects.length === 0) {
      while ((match = artworkLinkPattern.exec(html)) !== null && objects.length < 20) {
        const url = match[1];
        
        // Skip if already added
        if (objects.some(o => o.url.includes(url))) continue;
        
        // Extract title from URL
        const urlParts = url.split('/');
        const slug = urlParts[urlParts.length - 1];
        const title = slug
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());

        objects.push({
          id: `akg-${objects.length + 1}`,
          title,
          artist: artistName,
          url: `https://buffaloakg.org${url}`,
          location: 'Buffalo AKG Art Museum, Buffalo, NY',
        });
      }
    }

    console.log(`Found ${objects.length} artworks from Buffalo AKG`);

    return new Response(
      JSON.stringify({ objects }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error searching Buffalo AKG:', error);
    
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
