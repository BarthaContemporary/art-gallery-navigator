import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { track_id } = await req.json();
    if (!track_id) {
      return new Response(JSON.stringify({ error: "track_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Fetch the track
    const { data: track, error: trackError } = await supabase
      .from("audio_tracks")
      .select("storage_key, visibility")
      .eq("id", track_id)
      .maybeSingle();

    if (trackError || !track) {
      return new Response(JSON.stringify({ error: "Track not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (track.visibility === "public") {
      // Public tracks: return a public URL
      const { data } = supabase.storage.from("audio").getPublicUrl(track.storage_key);
      return new Response(JSON.stringify({ url: data.publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Private tracks: require auth
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required for private tracks" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: claims, error: claimsError } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Generate signed URL (5 minutes)
    const { data: signed, error: signError } = await supabase.storage
      .from("audio")
      .createSignedUrl(track.storage_key, 300);

    if (signError) {
      return new Response(JSON.stringify({ error: "Could not generate URL" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ url: signed.signedUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
