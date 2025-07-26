import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImageSearchResult {
  title: string;
  artist: string;
  imageUrl: string;
  year?: string;
  medium?: string;
  dimensions?: string;
  sourceUrl: string;
  source: 'artsy' | 'ocula';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { artist, title, year } = await req.json();
    
    if (!artist && !title) {
      return new Response(
        JSON.stringify({ error: 'Artist or title is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Searching for images: artist="${artist}", title="${title}", year="${year}"`);

    // Build search query
    let searchQuery = '';
    if (artist) searchQuery += `${artist} `;
    if (title) searchQuery += `${title} `;
    if (year) searchQuery += `${year}`;
    
    searchQuery = searchQuery.trim();
    
    const results: ImageSearchResult[] = [];
    
    // Search multiple sources in parallel
    const searchPromises = [
      searchArtsy(searchQuery, artist, title),
      searchOcula(searchQuery, artist, title)
    ];
    
    const searchResults = await Promise.allSettled(searchPromises);
    
    // Combine results from all sources
    searchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(...result.value);
      } else {
        const sourceName = index === 0 ? 'Artsy' : 'Ocula';
        console.error(`${sourceName} search failed:`, result.reason);
      }
    });

    console.log(`Found ${results.length} total results for search: ${searchQuery}`);
    
    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error searching Artsy:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to search Artsy' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Search Artsy.net for artwork images
async function searchArtsy(searchQuery: string, artist?: string, title?: string): Promise<ImageSearchResult[]> {
  const searchUrl = `https://www.artsy.net/search?q=${encodeURIComponent(searchQuery)}`;
  
  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0',
    },
  });

  if (!response.ok) {
    throw new Error(`Artsy search failed: ${response.status}`);
  }

  const html = await response.text();
  const results: ImageSearchResult[] = [];
  
  // Look for various image patterns from Artsy
  const imagePatterns = [
    /https:\/\/d32dm0rphc51dk\.cloudfront\.net\/[^"']+\.(?:jpg|jpeg|png)/gi,
    /https:\/\/[^"']*artsy[^"']*\.(?:jpg|jpeg|png)/gi,
  ];
  
  const allImages = new Set<string>();
  imagePatterns.forEach(pattern => {
    const matches = html.match(pattern) || [];
    matches.forEach(url => allImages.add(url));
  });
  
  const uniqueImages = Array.from(allImages).slice(0, 5);
  
  uniqueImages.forEach((imageUrl, i) => {
    results.push({
      title: title || `Artsy Result ${i + 1}`,
      artist: artist || 'Unknown Artist',
      imageUrl: imageUrl,
      sourceUrl: searchUrl,
      source: 'artsy',
    });
  });
  
  return results;
}

// Search Ocula.com for artwork images
async function searchOcula(searchQuery: string, artist?: string, title?: string): Promise<ImageSearchResult[]> {
  const searchUrl = `https://ocula.com/search/?q=${encodeURIComponent(searchQuery)}`;
  
  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0',
    },
  });

  if (!response.ok) {
    throw new Error(`Ocula search failed: ${response.status}`);
  }

  const html = await response.text();
  const results: ImageSearchResult[] = [];
  
  // Look for Ocula image patterns
  const imagePatterns = [
    /https:\/\/[^"']*ocula[^"']*\.(?:jpg|jpeg|png)/gi,
    /https:\/\/[^"']*cloudinary[^"']*ocula[^"']*\.(?:jpg|jpeg|png)/gi,
  ];
  
  const allImages = new Set<string>();
  imagePatterns.forEach(pattern => {
    const matches = html.match(pattern) || [];
    matches.forEach(url => allImages.add(url));
  });
  
  const uniqueImages = Array.from(allImages).slice(0, 5);
  
  uniqueImages.forEach((imageUrl, i) => {
    results.push({
      title: title || `Ocula Result ${i + 1}`,
      artist: artist || 'Unknown Artist',
      imageUrl: imageUrl,
      sourceUrl: searchUrl,
      source: 'ocula',
    });
  });
  
  return results;
}