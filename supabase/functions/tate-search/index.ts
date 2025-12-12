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

    console.log(`Tate search for artist: ${artistName}`);

    // Tate collection CSV is hosted on GitHub
    const csvUrl = 'https://raw.githubusercontent.com/tategallery/collection/master/artwork_data.csv';
    
    const response = await fetch(csvUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Tate data: ${response.status}`);
    }

    const csvText = await response.text();
    
    // Parse CSV and search for artist
    const lines = csvText.split('\n');
    const headers = parseCSVLine(lines[0]);
    
    // Find column indices
    const idIndex = headers.findIndex(h => h.toLowerCase() === 'id');
    const accessionIndex = headers.findIndex(h => h.toLowerCase() === 'accession_number');
    const artistIndex = headers.findIndex(h => h.toLowerCase() === 'artist');
    const artistIdIndex = headers.findIndex(h => h.toLowerCase() === 'artistid');
    const titleIndex = headers.findIndex(h => h.toLowerCase() === 'title');
    const dateIndex = headers.findIndex(h => h.toLowerCase() === 'datetext');
    const mediumIndex = headers.findIndex(h => h.toLowerCase() === 'medium');
    const creditLineIndex = headers.findIndex(h => h.toLowerCase() === 'creditline');
    const yearIndex = headers.findIndex(h => h.toLowerCase() === 'year');
    const thumbnailUrlIndex = headers.findIndex(h => h.toLowerCase() === 'thumbnailurl');
    const urlIndex = headers.findIndex(h => h.toLowerCase() === 'url');
    
    const searchTerm = artistName.toLowerCase();
    const foundObjects: any[] = [];
    
    // Search through artworks (limit to first 50 matches for performance)
    for (let i = 1; i < lines.length && foundObjects.length < 50; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      const values = parseCSVLine(line);
      const artistValue = values[artistIndex] || '';
      
      if (artistValue.toLowerCase().includes(searchTerm)) {
        const accessionNumber = values[accessionIndex] || '';
        
        foundObjects.push({
          id: values[idIndex] || '',
          accessionNumber: accessionNumber,
          title: values[titleIndex] || 'Untitled',
          artist: artistValue,
          artistId: values[artistIdIndex] || '',
          date: values[dateIndex] || '',
          year: values[yearIndex] || '',
          medium: values[mediumIndex] || '',
          creditLine: values[creditLineIndex] || '',
          thumbnailUrl: values[thumbnailUrlIndex] || `https://www.tate.org.uk/art/images/work/${accessionNumber.replace(/\s/g, '')}/2.jpg`,
          url: values[urlIndex] || `https://www.tate.org.uk/art/artworks/${accessionNumber.toLowerCase().replace(/\s/g, '-')}`
        });
      }
    }

    console.log(`Found ${foundObjects.length} Tate objects for artist: ${artistName}`);

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
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
