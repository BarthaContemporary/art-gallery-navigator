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

    console.info(`Searching Rijksmuseum for: ${artistName}`);

    // Use AbortController for timeout - OAI-PMH can be very slow
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    let response;
    try {
      // Query the OAI-PMH endpoint with ListRecords
      const oaiUrl = new URL('https://data.rijksmuseum.nl/oai');
      oaiUrl.searchParams.set('verb', 'ListRecords');
      oaiUrl.searchParams.set('metadataPrefix', 'oai_dc');

      response = await fetch(oaiUrl.toString(), {
        headers: {
          'Accept': 'application/xml',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      try { clearTimeout(timeoutId); } catch (_) { /* ignore */ }
      console.info('Rijksmuseum API timeout or unavailable - returning empty results');
      return new Response(
        JSON.stringify({ 
          objects: [],
          totalObjects: 0,
          note: 'Rijksmuseum API temporarily unavailable'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      console.info(`Rijksmuseum API returned ${response.status} - returning empty results`);
      return new Response(
        JSON.stringify({ 
          objects: [],
          totalObjects: 0,
          note: 'Rijksmuseum API temporarily unavailable'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const xmlText = await response.text();
    
    // Parse the XML response to find records matching the artist name
    const artistNameLower = artistName.toLowerCase();
    const objects: Array<{
      id: string;
      title: string;
      creator: string;
      date: string;
      description: string;
      imageUrl: string | null;
    }> = [];

    // Simple XML parsing for OAI-PMH Dublin Core records
    // Look for <record> elements containing the artist name in <dc:creator>
    const recordRegex = /<record>([\s\S]*?)<\/record>/g;
    let match;
    
    while ((match = recordRegex.exec(xmlText)) !== null && objects.length < 10) {
      const record = match[1];
      
      // Extract creator (artist)
      const creatorMatch = record.match(/<dc:creator>([^<]*)<\/dc:creator>/i);
      const creator = creatorMatch ? creatorMatch[1].trim() : '';
      
      // Check if this record matches the artist
      if (creator.toLowerCase().includes(artistNameLower) || 
          artistNameLower.split(' ').some(part => creator.toLowerCase().includes(part))) {
        
        // Extract other Dublin Core fields
        const identifierMatch = record.match(/<dc:identifier>([^<]*)<\/dc:identifier>/i);
        const titleMatch = record.match(/<dc:title>([^<]*)<\/dc:title>/i);
        const dateMatch = record.match(/<dc:date>([^<]*)<\/dc:date>/i);
        const descriptionMatch = record.match(/<dc:description>([^<]*)<\/dc:description>/i);
        
        objects.push({
          id: identifierMatch ? identifierMatch[1].trim() : `rijks-${objects.length}`,
          title: titleMatch ? titleMatch[1].trim() : 'Untitled',
          creator: creator,
          date: dateMatch ? dateMatch[1].trim() : '',
          description: descriptionMatch ? descriptionMatch[1].trim() : '',
          imageUrl: null, // OAI-PMH DC doesn't typically include images
        });
      }
    }

    console.info(`Found ${objects.length} Rijksmuseum objects for ${artistName}`);

    return new Response(
      JSON.stringify({
        objects,
        totalObjects: objects.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Rijksmuseum search error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        objects: [],
        totalObjects: 0,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
