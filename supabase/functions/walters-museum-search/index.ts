import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse CSV line handling quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

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

    console.log(`Walters Museum: Searching for artist: ${artistName}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // Walters API v1 closed in 2023 - now using CSV data from GitHub
    const csvUrl = 'https://raw.githubusercontent.com/WaltersArtMuseum/api-thewalters-org/main/art.csv';
    
    const response = await fetch(csvUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/csv',
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Walters CSV fetch error: ${response.status}`);
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const csvText = await response.text();
    const lines = csvText.split('\n');
    
    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse header to find column indices
    const headers = parseCSVLine(lines[0]);
    const objectIdIdx = headers.findIndex(h => h.toLowerCase().includes('objectid') || h.toLowerCase() === 'objectnumber');
    const titleIdx = headers.findIndex(h => h.toLowerCase() === 'title');
    const creatorIdx = headers.findIndex(h => h.toLowerCase() === 'creator' || h.toLowerCase() === 'artist');
    const dateIdx = headers.findIndex(h => h.toLowerCase() === 'datetext' || h.toLowerCase() === 'date');
    const mediumIdx = headers.findIndex(h => h.toLowerCase() === 'medium');
    const collectionIdx = headers.findIndex(h => h.toLowerCase() === 'collection');
    const dimensionsIdx = headers.findIndex(h => h.toLowerCase() === 'dimensions');

    console.log(`Walters CSV: Found ${lines.length - 1} total records, searching...`);

    const searchLower = artistName.toLowerCase();
    const searchParts = searchLower.split(' ').filter(p => p.length > 2);
    const foundObjects: any[] = [];

    for (let i = 1; i < lines.length && foundObjects.length < 50; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const fields = parseCSVLine(line);
      const creator = creatorIdx >= 0 ? fields[creatorIdx] || '' : '';
      
      // Match artist name
      const creatorLower = creator.toLowerCase();
      const isMatch = searchParts.every(part => creatorLower.includes(part)) ||
                     creatorLower.includes(searchLower);

      if (isMatch && creator) {
        const objectId = objectIdIdx >= 0 ? fields[objectIdIdx] : '';
        foundObjects.push({
          id: objectId || `walters-${i}`,
          title: titleIdx >= 0 ? fields[titleIdx] || 'Untitled' : 'Untitled',
          artist: creator,
          date: dateIdx >= 0 ? fields[dateIdx] || '' : '',
          medium: mediumIdx >= 0 ? fields[mediumIdx] || '' : '',
          dimensions: dimensionsIdx >= 0 ? fields[dimensionsIdx] || '' : '',
          collection: collectionIdx >= 0 ? fields[collectionIdx] || 'Walters Art Museum' : 'Walters Art Museum',
          imageUrl: null, // CSV doesn't include images directly
          url: objectId ? `https://art.thewalters.org/detail/${objectId}` : 'https://thewalters.org/collection/',
        });
      }
    }

    console.log(`Walters Museum: Found ${foundObjects.length} matching records`);

    return new Response(
      JSON.stringify({ 
        objects: foundObjects, 
        totalObjects: foundObjects.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Walters Museum search error:', error);
    return new Response(
      JSON.stringify({ objects: [], totalObjects: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
