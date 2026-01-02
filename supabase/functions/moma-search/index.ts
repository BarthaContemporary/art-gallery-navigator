import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

serve(async (req) => {
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

    console.log(`MoMA search for artist: ${artistName}`);

    // Try MoMA's collection search with JSON response
    // MoMA uses a format=json parameter for their collection searches
    const searchUrl = `https://www.moma.org/collection/?utf8=%E2%9C%93&q=${encodeURIComponent(artistName)}&classifications=any&date_begin=Pre-1850&date_end=2025&geo=any&with_images=1&page=1`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    
    let html;
    try {
      const response = await fetch(searchUrl, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
        }
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`MoMA returned ${response.status} - returning empty results`);
        return new Response(
          JSON.stringify({ objects: [], totalObjects: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      html = await response.text();
      console.log(`Received ${html.length} bytes from MoMA`);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.log('MoMA timeout or unavailable - returning empty results');
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const foundObjects: any[] = [];
    
    // MoMA uses Next.js - look for __NEXT_DATA__ script tag with initial props
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        console.log('Found __NEXT_DATA__, parsing...');
        
        // Navigate the Next.js data structure
        const pageProps = nextData?.props?.pageProps;
        const works = pageProps?.works || pageProps?.results?.works || pageProps?.initialWorks || [];
        
        for (const work of works.slice(0, 50)) {
          foundObjects.push({
            objectId: work.id || work.objectId || '',
            title: work.title || work.name || 'Untitled',
            artist: work.artistName || work.artist || artistName,
            date: work.date || work.year || work.dateText || '',
            medium: work.medium || work.materials || '',
            department: work.department || work.classification || '',
            thumbnailUrl: work.image?.url || work.imageUrl || work.thumbnail || '',
            url: work.url || (work.id ? `https://www.moma.org/collection/works/${work.id}` : '')
          });
        }
        console.log(`Parsed ${foundObjects.length} works from Next.js data`);
      } catch (e) {
        console.log('Failed to parse __NEXT_DATA__:', e);
      }
    }
    
    // If no Next.js data, try parsing HTML directly
    if (foundObjects.length === 0) {
      console.log('No Next.js data found, parsing HTML...');
      
      // Look for work links in the HTML
      // Pattern: /collection/works/123456
      const workLinkRegex = /\/collection\/works\/(\d+)/g;
      const workIds = new Set<string>();
      let match;
      
      while ((match = workLinkRegex.exec(html)) !== null) {
        workIds.add(match[1]);
      }
      
      console.log(`Found ${workIds.size} unique work IDs in HTML`);
      
      // For each work ID, create an entry
      for (const workId of Array.from(workIds).slice(0, 30)) {
        foundObjects.push({
          objectId: workId,
          title: 'View artwork on MoMA',
          artist: artistName,
          date: '',
          medium: '',
          department: '',
          thumbnailUrl: '',
          url: `https://www.moma.org/collection/works/${workId}`
        });
      }
    }
    
    // Try to extract image URLs if we have work IDs
    if (foundObjects.length > 0) {
      // Look for image patterns
      const imagePatterns = [
        /https:\/\/www\.moma\.org\/media\/[^"'\s]+/g,
        /https:\/\/[^"'\s]*moma[^"'\s]*\.jpg/gi,
        /src="([^"]*\/collection\/[^"]*\.jpg)"/gi
      ];
      
      const images: string[] = [];
      for (const pattern of imagePatterns) {
        let imgMatch;
        while ((imgMatch = pattern.exec(html)) !== null) {
          images.push(imgMatch[1] || imgMatch[0]);
        }
      }
      
      // Assign images to objects if we found any
      for (let i = 0; i < Math.min(images.length, foundObjects.length); i++) {
        if (!foundObjects[i].thumbnailUrl) {
          foundObjects[i].thumbnailUrl = images[i];
        }
      }
    }

    console.log(`Found ${foundObjects.length} MoMA objects for artist: ${artistName}`);

    return new Response(
      JSON.stringify({
        objects: foundObjects,
        totalObjects: foundObjects.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('MoMA search error:', error);
    return new Response(
      JSON.stringify({ objects: [], totalObjects: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
