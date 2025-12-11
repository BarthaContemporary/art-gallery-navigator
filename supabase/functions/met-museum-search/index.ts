import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

interface MetObject {
  objectID: number;
  title: string;
  artistDisplayName: string;
  objectDate: string;
  medium: string;
  primaryImage: string;
  primaryImageSmall: string;
  department: string;
  objectURL: string;
  classification: string;
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

    console.info(`Searching MET Museum for: ${artistName}`);

    // Search for objects by artist name
    const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?artistOrCulture=true&q=${encodeURIComponent(artistName)}`;
    
    const searchResponse = await fetch(searchUrl);
    
    if (!searchResponse.ok) {
      console.error(`MET API search error: ${searchResponse.status}`);
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchData = await searchResponse.json();
    
    if (!searchData.objectIDs || searchData.objectIDs.length === 0) {
      console.info(`No MET objects found for: ${artistName}`);
      return new Response(
        JSON.stringify({ objects: [], totalObjects: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.info(`Found ${searchData.total} MET object IDs`);

    // Fetch details for the first 10 objects
    const objectIds = searchData.objectIDs.slice(0, 10);
    const objects: MetObject[] = [];

    for (const objectId of objectIds) {
      try {
        const objectResponse = await fetch(
          `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`
        );
        
        if (objectResponse.ok) {
          const objectData = await objectResponse.json();
          
          // Only include objects that match the artist name
          if (objectData.artistDisplayName && 
              objectData.artistDisplayName.toLowerCase().includes(artistName.toLowerCase().split(' ')[0])) {
            objects.push({
              objectID: objectData.objectID,
              title: objectData.title || 'Untitled',
              artistDisplayName: objectData.artistDisplayName || '',
              objectDate: objectData.objectDate || '',
              medium: objectData.medium || '',
              primaryImage: objectData.primaryImage || '',
              primaryImageSmall: objectData.primaryImageSmall || '',
              department: objectData.department || '',
              objectURL: objectData.objectURL || '',
              classification: objectData.classification || '',
            });
          }
        }
      } catch (err) {
        console.error(`Error fetching MET object ${objectId}:`, err);
      }
    }

    console.info(`Returning ${objects.length} MET objects for ${artistName}`);

    return new Response(
      JSON.stringify({
        objects,
        totalObjects: searchData.total || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('MET Museum search error:', error);
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
