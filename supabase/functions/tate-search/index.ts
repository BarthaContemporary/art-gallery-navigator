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

    console.log(`Tate search for artist: ${artistName}`);

    const searchUrl = `https://www.tate.org.uk/search?q=${encodeURIComponent(artistName)}&type=artwork`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    let htmlText;
    try {
      const response = await fetch(searchUrl, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`Tate search returned ${response.status}`);
        return new Response(
          JSON.stringify({ objects: [], totalObjects: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      htmlText = await response.text();
      console.log(`Tate HTML length: ${htmlText.length}`);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.log('Tate search timeout or unavailable');
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const foundObjects: any[] = [];
    const artistNameLower = artistName.toLowerCase();
    const artistParts = artistNameLower.split(' ').filter(p => p.length > 2);
    
    // Extract all artwork URLs
    const artworkUrls: string[] = [];
    const urlRegex = /href="(https:\/\/www\.tate\.org\.uk\/art\/artworks\/[^"]+)"/g;
    let match;
    while ((match = urlRegex.exec(htmlText)) !== null) {
      if (!artworkUrls.includes(match[1])) {
        artworkUrls.push(match[1]);
      }
    }
    
    console.log(`Tate: Found ${artworkUrls.length} artwork URLs`);

    for (const url of artworkUrls) {
      if (foundObjects.length >= 50) break;
      
      const slug = url.split('/').pop() || '';
      
      // Check if URL contains artist name
      const slugLower = slug.toLowerCase();
      const matchesArtist = artistParts.some(part => slugLower.startsWith(part) || slugLower.includes(`-${part}-`) || slugLower.includes(`${part}-`));
      
      if (!matchesArtist) continue;
      
      // Extract accession number (e.g., t14292)
      const accessionMatch = slug.match(/-([a-z]\d+)$/i);
      const accession = accessionMatch ? accessionMatch[1].toUpperCase() : '';
      
      if (!accession) continue;
      
      // Extract title from slug (remove artist name prefix and accession suffix)
      let titleSlug = slug;
      // Remove accession
      titleSlug = titleSlug.replace(/-[a-z]\d+$/i, '');
      // Remove common artist name patterns at start
      for (const part of artistParts) {
        if (titleSlug.toLowerCase().startsWith(part + '-')) {
          titleSlug = titleSlug.substring(part.length + 1);
        }
      }
      
      // Convert slug to title
      const title = titleSlug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      // Try to extract year from HTML near this URL
      const urlIndex = htmlText.indexOf(url);
      let year = '';
      if (urlIndex > -1) {
        // Look for year pattern after URL in nearby HTML (within 1000 chars)
        const nearbyHtml = htmlText.substring(urlIndex, urlIndex + 1000);
        const yearMatch = nearbyHtml.match(/card__when--artwork-date[^>]*>(\d{4})</);
        if (yearMatch) {
          year = yearMatch[1];
        }
      }
      
      foundObjects.push({
        id: accession,
        accessionNumber: accession,
        title: title || 'Untitled',
        artist: artistName,
        artistId: '',
        date: year,
        year: year,
        medium: '',
        creditLine: 'Tate Collection',
        thumbnailUrl: `https://www.tate.org.uk/art/images/work/${accession}/1.jpg`,
        url: url,
        location: 'Tate, London',
        dimensions: '',
        collection: 'Tate'
      });
    }

    console.log(`Tate: Found ${foundObjects.length} objects for artist: ${artistName}`);

    return new Response(
      JSON.stringify({
        objects: foundObjects,
        totalObjects: foundObjects.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Tate search error:', error);
    return new Response(
      JSON.stringify({ objects: [], totalObjects: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
