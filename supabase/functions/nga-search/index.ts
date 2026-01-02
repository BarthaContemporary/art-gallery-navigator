import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// NGA uses a bulk dataset approach - we'll search the published JSON data
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

    console.log(`National Gallery of Art (NGA): Searching for artist: ${artistName}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    // NGA publishes data on GitHub - we fetch the published objects JSON
    const response = await fetch(
      'https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data/published_images.csv',
      {
        signal: controller.signal,
        headers: {
          'Accept': 'text/csv',
        }
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`NGA data fetch error: ${response.status}`);
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const csvText = await response.text();
    const lines = csvText.split('\n');
    const headers = parseCSVLine(lines[0]);
    
    const artistNameLower = artistName.toLowerCase();
    const matchingObjects: any[] = [];

    for (let i = 1; i < lines.length && matchingObjects.length < 50; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = parseCSVLine(line);
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = values[index] || '';
      });

      // Check if artist name matches
      const attribution = (record['attribution'] || record['attributioninverted'] || '').toLowerCase();
      if (attribution.includes(artistNameLower)) {
        matchingObjects.push({
          id: record['uuid'] || record['objectid'] || `nga-${i}`,
          title: record['title'] || 'Untitled',
          artist: record['attribution'] || record['attributioninverted'] || artistName,
          date: record['displaydate'] || '',
          medium: record['medium'] || record['classification'] || '',
          imageUrl: record['iiifthumburl'] || record['iiifurl'] || null,
          url: `https://www.nga.gov/collection/art-object-page.${record['objectid']}.html`,
          collection: 'National Gallery of Art (Washington)'
        });
      }
    }

    console.log(`NGA: Found ${matchingObjects.length} matching records`);

    return new Response(
      JSON.stringify({ 
        objects: matchingObjects, 
        totalObjects: matchingObjects.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('NGA search error:', error);
    return new Response(
      JSON.stringify({ objects: [], totalObjects: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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
