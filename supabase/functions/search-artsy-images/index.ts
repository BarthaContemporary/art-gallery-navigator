import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ArtsySearchResult {
  title: string;
  artist: string;
  imageUrl: string;
  year?: string;
  medium?: string;
  dimensions?: string;
  sourceUrl: string;
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

    console.log(`Searching Artsy for: artist="${artist}", title="${title}", year="${year}"`);

    // Build search query
    let searchQuery = '';
    if (artist) searchQuery += `${artist} `;
    if (title) searchQuery += `${title} `;
    if (year) searchQuery += `${year}`;
    
    searchQuery = searchQuery.trim();
    
    // Search Artsy using their public search
    const searchUrl = `https://www.artsy.net/search?q=${encodeURIComponent(searchQuery)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (!response.ok) {
      throw new Error(`Artsy search failed: ${response.status}`);
    }

    const html = await response.text();
    
    // Parse HTML to extract artwork results
    const results: ArtsySearchResult[] = [];
    
    // Simple regex to find artwork data in the HTML
    // Look for image URLs and artwork information
    const imageRegex = /https:\/\/d32dm0rphc51dk\.cloudfront\.net\/[^"]+\.jpg/g;
    const artworkRegex = /<a[^>]+href="\/artwork\/([^"]+)"[^>]*>.*?<img[^>]+src="([^"]+)"[^>]*>.*?<\/a>/gs;
    
    const imageMatches = html.match(imageRegex) || [];
    const uniqueImages = [...new Set(imageMatches)].slice(0, 10); // Limit to 10 results
    
    // Extract artwork links and metadata
    let match;
    let index = 0;
    while ((match = artworkRegex.exec(html)) !== null && index < uniqueImages.length) {
      const artworkSlug = match[1];
      const imageUrl = uniqueImages[index];
      
      if (imageUrl) {
        results.push({
          title: title || 'Untitled',
          artist: artist || 'Unknown Artist',
          imageUrl: imageUrl,
          sourceUrl: `https://www.artsy.net/artwork/${artworkSlug}`,
        });
        index++;
      }
    }
    
    // If no structured results found, use the unique images with basic info
    if (results.length === 0) {
      uniqueImages.forEach((imageUrl, i) => {
        results.push({
          title: title || `Result ${i + 1}`,
          artist: artist || 'Unknown Artist',
          imageUrl: imageUrl,
          sourceUrl: searchUrl,
        });
      });
    }

    console.log(`Found ${results.length} results for search: ${searchQuery}`);
    
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