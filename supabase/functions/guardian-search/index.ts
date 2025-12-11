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

    const GUARDIAN_API_KEY = Deno.env.get("GUARDIAN_API_KEY");
    if (!GUARDIAN_API_KEY) {
      console.error("GUARDIAN_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Guardian API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Search for artist name combined with "art" or "artist"
    const searchQuery = `${artistName} AND (art OR artist OR exhibition OR gallery)`;
    const encodedQuery = encodeURIComponent(searchQuery);
    
    const url = `https://content.guardianapis.com/search?q=${encodedQuery}&api-key=${GUARDIAN_API_KEY}&show-fields=headline,trailText,thumbnail,shortUrl,byline&page-size=10&order-by=relevance`;

    console.log("Searching Guardian for:", artistName);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Guardian API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Guardian API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("Guardian results:", data.response?.total || 0, "articles found");

    const articles = data.response?.results?.map((result: any) => ({
      id: result.id,
      title: result.fields?.headline || result.webTitle,
      description: result.fields?.trailText,
      thumbnail: result.fields?.thumbnail,
      url: result.webUrl,
      shortUrl: result.fields?.shortUrl,
      byline: result.fields?.byline,
      sectionName: result.sectionName,
      publishedDate: result.webPublicationDate,
    })) || [];

    return new Response(
      JSON.stringify({ 
        success: true, 
        articles,
        total: data.response?.total || 0 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Guardian search error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
