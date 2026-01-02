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

    // MoMA collection CSV is hosted on GitHub
    const csvUrl = 'https://raw.githubusercontent.com/MuseumofModernArt/collection/main/Artworks.csv';
    
    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    let csvText;
    try {
      const response = await fetch(csvUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch MoMA data: ${response.status}`);
      }
      csvText = await response.text();
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.log('MoMA data timeout or unavailable - returning empty results');
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse CSV and search for artist
    const lines = csvText.split('\n');
    const headers = parseCSVLine(lines[0]);
    
    const artistIndex = headers.findIndex(h => h.toLowerCase() === 'artist');
    const titleIndex = headers.findIndex(h => h.toLowerCase() === 'title');
    const dateIndex = headers.findIndex(h => h.toLowerCase() === 'date');
    const mediumIndex = headers.findIndex(h => h.toLowerCase() === 'medium');
    const departmentIndex = headers.findIndex(h => h.toLowerCase() === 'department');
    const objectIdIndex = headers.findIndex(h => h.toLowerCase() === 'objectid');
    const thumbnailUrlIndex = headers.findIndex(h => h.toLowerCase() === 'thumbnailurl');
    const urlIndex = headers.findIndex(h => h.toLowerCase() === 'url');
    
    // Create search variations (handle "Last, First" format in CSV)
    const searchTermLower = artistName.toLowerCase();
    const nameParts = artistName.split(' ').filter(p => p.length > 0);
    // Create "Last, First" variation if we have at least 2 parts
    const lastFirstVariation = nameParts.length >= 2 
      ? `${nameParts[nameParts.length - 1]}, ${nameParts.slice(0, -1).join(' ')}`.toLowerCase()
      : null;
    
    const foundObjects: any[] = [];
    
    // Search through artworks (limit to first 50 matches for performance)
    for (let i = 1; i < lines.length && foundObjects.length < 50; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      const values = parseCSVLine(line);
      const artistValue = values[artistIndex] || '';
      const artistLower = artistValue.toLowerCase();
      
      // Match against both "First Last" and "Last, First" formats
      const matches = artistLower.includes(searchTermLower) || 
        (lastFirstVariation && artistLower.includes(lastFirstVariation));
      
      if (matches) {
        foundObjects.push({
          objectId: values[objectIdIndex] || '',
          title: values[titleIndex] || 'Untitled',
          artist: artistValue,
          date: values[dateIndex] || '',
          medium: values[mediumIndex] || '',
          department: values[departmentIndex] || '',
          thumbnailUrl: values[thumbnailUrlIndex] || '',
          url: values[urlIndex] || ''
        });
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

// Simple CSV line parser that handles quoted fields
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
