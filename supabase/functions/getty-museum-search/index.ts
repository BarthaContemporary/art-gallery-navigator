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

    // Use Getty's public collection website search
    const searchUrl = `https://www.getty.edu/art/collection/search?q=${encodeURIComponent(artistName)}`;
    
    let html: string;
    try {
      const response = await fetch(searchUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`Getty Museum page error: ${response.status}`);
        return new Response(
          JSON.stringify({ objects: [], totalObjects: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      html = await response.text();
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.log('Getty fetch error:', fetchError);
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const foundObjects: any[] = [];

    // Look for object links in the HTML: /art/collection/object/XXXX
    const objectLinkRegex = /\/art\/collection\/object\/(\d+)/g;
    const objectIds = new Set<string>();
    let match;
    
    while ((match = objectLinkRegex.exec(html)) !== null) {
      objectIds.add(match[1]);
    }

    console.log(`Getty: Found ${objectIds.size} unique object IDs`);

    // Try to extract titles from the HTML
    // Look for patterns like: <a href="/art/collection/object/123">Title</a>
    const titleRegex = /<a[^>]*href="\/art\/collection\/object\/(\d+)"[^>]*>([^<]+)<\/a>/gi;
    const titlesMap = new Map<string, string>();
    
    while ((match = titleRegex.exec(html)) !== null) {
      const id = match[1];
      const title = match[2].trim();
      if (title && !titlesMap.has(id)) {
        titlesMap.set(id, title);
      }
    }

    // Look for image URLs
    const imageRegex = /https:\/\/[^"'\s]*media\.getty\.edu[^"'\s]*(\.jpg|\.jpeg|\.png)/gi;
    const images: string[] = [];
    while ((match = imageRegex.exec(html)) !== null) {
      images.push(match[0]);
    }

    let imageIdx = 0;
    for (const objectId of Array.from(objectIds).slice(0, 30)) {
      const title = titlesMap.get(objectId) || 'View on Getty';
      foundObjects.push({
        id: objectId,
        title: title,
        artist: artistName,
        date: '',
        medium: '',
        imageUrl: images[imageIdx] || null,
        url: `https://www.getty.edu/art/collection/object/${objectId}`,
        collection: 'J. Paul Getty Museum'
      });
      imageIdx++;
    }

    console.log(`Getty Museum: Found ${foundObjects.length} objects for artist: ${artistName}`);

    return new Response(
      JSON.stringify({ 
        objects: foundObjects, 
        totalObjects: foundObjects.length 
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
