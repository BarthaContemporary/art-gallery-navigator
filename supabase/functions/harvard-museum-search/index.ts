import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { artistName } = await req.json();

    if (!artistName) {
      return new Response(
        JSON.stringify({ success: false, error: "Artist name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const HARVARD_API_KEY = Deno.env.get("HARVARD_MUSEUMS_API_KEY");
    if (!HARVARD_API_KEY) {
      console.error("HARVARD_MUSEUMS_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Harvard Museums API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Searching Harvard Art Museums for:", artistName);

    // Helper function to fetch with timeout and error handling
    const fetchWithTimeout = async (url: string, timeoutMs: number = 8000) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    };

    let personData = { records: [], info: { totalrecords: 0 } };
    let objectData = { records: [], info: { totalrecords: 0 } };

    // First, search for the person/artist
    try {
      const personUrl = `https://api.harvardartmuseums.org/person?apikey=${HARVARD_API_KEY}&q=${encodeURIComponent(artistName)}&size=5`;
      const personResponse = await fetchWithTimeout(personUrl);
      
      if (personResponse.ok) {
        personData = await personResponse.json();
        console.log("Found", personData.info?.totalrecords || 0, "matching artists");
      } else {
        console.error("Harvard Person API error:", personResponse.status);
      }
    } catch (error) {
      console.log("Harvard Person API timeout or unavailable - continuing with empty results");
    }

    // Search for objects by this artist
    try {
      const objectUrl = `https://api.harvardartmuseums.org/object?apikey=${HARVARD_API_KEY}&person=${encodeURIComponent(artistName)}&size=20&sort=rank&sortorder=desc&hasimage=1`;
      const objectResponse = await fetchWithTimeout(objectUrl);
      
      if (objectResponse.ok) {
        objectData = await objectResponse.json();
        console.log("Found", objectData.info?.totalrecords || 0, "objects");
      } else {
        console.error("Harvard Object API error:", objectResponse.status);
      }
    } catch (error) {
      console.log("Harvard Object API timeout or unavailable - continuing with empty results");
    }
    console.log("Found", objectData.info?.totalrecords || 0, "objects");

    const objects = objectData.records?.map((obj: any) => ({
      id: obj.objectid,
      title: obj.title || "Untitled",
      dated: obj.dated,
      medium: obj.medium,
      classification: obj.classification,
      primaryImageUrl: obj.primaryimageurl,
      url: obj.url,
      creditLine: obj.creditline,
      dimensions: obj.dimensions,
      people: obj.people?.map((p: any) => p.displayname) || [],
    })) || [];

    const artists = personData.records?.map((person: any) => ({
      id: person.personid,
      name: person.displayname,
      culture: person.culture,
      birthplace: person.birthplace,
      deathplace: person.deathplace,
      displaydate: person.displaydate,
      objectcount: person.objectcount,
      url: person.url,
    })) || [];

    return new Response(
      JSON.stringify({ 
        success: true, 
        objects,
        artists,
        totalObjects: objectData.info?.totalrecords || 0,
        totalArtists: personData.info?.totalrecords || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Harvard Museum search error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
