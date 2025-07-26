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
  source: 'artsy' | 'ocula' | 'google';
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
      searchCustomSearchSite(searchQuery, 'artsy.net', artist, title),
      searchCustomSearchSite(searchQuery, 'ocula.com', artist, title)
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

    // If we don't have enough results, search Google Images generally
    if (results.length < 3) {
      try {
        const generalResults = await searchGeneralImages(searchQuery, artist, title);
        results.push(...generalResults);
      } catch (error) {
        console.error('General Google Images search failed:', error);
      }
    }

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

// Use Google Custom Search API to search specific sites
async function searchCustomSearchSite(searchQuery: string, site: string, artist?: string, title?: string): Promise<ImageSearchResult[]> {
  const apiKey = Deno.env.get('GOOGLE_CUSTOM_SEARCH_API_KEY');
  const searchEngineId = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');
  
  console.log('API Key available:', !!apiKey);
  console.log('Search Engine ID available:', !!searchEngineId);
  console.log('API Key (first 10 chars):', apiKey?.substring(0, 10));
  console.log('Search Engine ID:', searchEngineId);
  
  if (!apiKey || !searchEngineId) {
    console.error('Google Custom Search API credentials not configured');
    console.error('API Key missing:', !apiKey);
    console.error('Search Engine ID missing:', !searchEngineId);
    return [];
  }

  const query = `site:${site} "${artist}" "${title}" ${searchQuery}`.trim();
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&searchType=image&num=10&safe=active`;
  
  console.log(`Searching ${site} with Custom Search API: ${query}`);
  
  try {
    const response = await fetch(url);
    
    console.log(`API Response status for ${site}:`, response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Custom Search API failed for ${site}: ${response.status} - ${errorText}`);
      throw new Error(`Custom Search API failed for ${site}: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`API Response data for ${site}:`, JSON.stringify(data, null, 2));
    
    const results: ImageSearchResult[] = [];
    
    if (data.items && Array.isArray(data.items)) {
      console.log(`Found ${data.items.length} items from ${site}`);
      data.items.forEach((item: any, i: number) => {
        console.log(`Processing item ${i}:`, {
          link: item.link,
          title: item.title,
          hasImage: !!item.image
        });
        
        if (item.link && item.link.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          results.push({
            title: item.title || title || `${site} Result ${i + 1}`,
            artist: artist || 'Unknown Artist',
            imageUrl: item.link,
            sourceUrl: item.image?.contextLink || `https://${site}`,
            source: site === 'artsy.net' ? 'artsy' : 'ocula',
          });
        }
      });
    } else {
      console.log(`No items found in response for ${site}:`, data);
    }
    
    console.log(`Found ${results.length} images from ${site} via Custom Search`);
    return results.slice(0, 5);
  } catch (error) {
    console.error(`Custom Search failed for ${site}:`, error);
    return [];
  }
}

// General Google Images search as fallback
async function searchGeneralImages(searchQuery: string, artist?: string, title?: string): Promise<ImageSearchResult[]> {
  const apiKey = Deno.env.get('GOOGLE_CUSTOM_SEARCH_API_KEY');
  const searchEngineId = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');
  
  if (!apiKey || !searchEngineId) {
    console.error('Google Custom Search API credentials not configured');
    return [];
  }

  const query = `"${artist}" "${title}" ${searchQuery} artwork art`.trim();
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&searchType=image&num=5&safe=active`;
  
  console.log(`Searching Google Images generally: ${query}`);
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Custom Search API failed for general search: ${response.status}`);
    }
    
    const data = await response.json();
    const results: ImageSearchResult[] = [];
    
    if (data.items) {
      data.items.forEach((item: any, i: number) => {
        if (item.link && item.link.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          results.push({
            title: item.title || title || `Google Result ${i + 1}`,
            artist: artist || 'Unknown Artist',
            imageUrl: item.link,
            sourceUrl: item.image?.contextLink || item.displayLink || 'https://google.com',
            source: 'google',
          });
        }
      });
    }
    
    console.log(`Found ${results.length} images from general Google search`);
    return results;
  } catch (error) {
    console.error('General Google Images search failed:', error);
    return [];
  }
}