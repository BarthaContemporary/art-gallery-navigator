import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(
      JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let nodeId: string | null = null;

  try {
    const body = await req.json();
    nodeId = body.node_id;
    if (!nodeId) throw new Error("node_id is required");

    // Mark as processing
    await supabase
      .from("tour_nodes")
      .update({ stitch_status: "processing" })
      .eq("id", nodeId);

    // Fetch strip + source reference photos to reduce AI hallucination
    const [{ data: node, error: nodeErr }, { data: sourceImages, error: sourceImagesErr }] = await Promise.all([
      supabase
        .from("tour_nodes")
        .select("panorama_strip_url")
        .eq("id", nodeId)
        .single(),
      supabase
        .from("tour_node_images")
        .select("original_url, display_order")
        .eq("node_id", nodeId)
        .order("display_order", { ascending: true })
        .limit(8),
    ]);

    if (nodeErr) throw nodeErr;
    if (sourceImagesErr) {
      console.warn("Could not load source reference images:", sourceImagesErr.message);
    }

    const stripUrl = node?.panorama_strip_url;
    if (!stripUrl) {
      throw new Error("No panorama strip found. Please save one in the Composer first.");
    }

    const referenceImageUrls = (sourceImages ?? [])
      .map((img: { original_url: string | null }) => img.original_url)
      .filter((url): url is string => !!url);

    console.log("Converting HD panorama strip to equirectangular:", stripUrl);

    const prompt = [
      "You are a professional 360 panorama projection engine.",
      "Transform the provided stitched strip into ONE seamless equirectangular panorama with exact dimensions 4096x2048 (strict 2:1).",
      "Hard constraints:",
      "1) Preserve all visible geometry, materials, textures, and lighting from the strip exactly in the central horizon band.",
      "2) Do not invent, remove, duplicate, or restyle objects, text, signage, architecture, furniture, people, or vehicles.",
      "3) Keep a single fixed camera origin and ensure perfect left/right seam continuity for immersive spherical viewing.",
      "4) Only extend missing zenith (top) and nadir (bottom) areas using realistic continuation inferred from source context.",
      "5) Keep output photorealistic, sharp, and distortion-controlled with clean edges (no melting or warped structures).",
      "Output only a single final image.",
    ].join("\n");

    const content = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: stripUrl } },
      ...referenceImageUrls.map((url) => ({
        type: "image_url",
        image_url: { url },
      })),
    ];

    // AI call to convert strip to 4K equirectangular projection with strict faithfulness
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        temperature: 0.2,
        messages: [
          {
            role: "user",
            content,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("AI gateway error:", resp.status, errText);
      if (resp.status === 429) throw new Error("RATE_LIMITED");
      if (resp.status === 402) throw new Error("CREDITS_EXHAUSTED");
      throw new Error(`AI gateway error: ${resp.status}`);
    }

    const data = await resp.json();
    const msg = data.choices?.[0]?.message;

    // Extract image from response
    let imageData: string | null = null;

    // Path 1: images array
    if (msg?.images?.[0]?.image_url?.url) {
      imageData = msg.images[0].image_url.url;
    }

    // Path 2: inline_data in content array
    if (!imageData && Array.isArray(msg?.content)) {
      for (const part of msg.content) {
        if (part.type === "image_url" && part.image_url?.url) {
          imageData = part.image_url.url;
          break;
        }
        if (part.inline_data?.data) {
          imageData = `data:${part.inline_data.mime_type || "image/png"};base64,${part.inline_data.data}`;
          break;
        }
      }
    }

    // Path 3: base64 in content string
    if (!imageData && typeof msg?.content === "string") {
      const b64Match = msg.content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
      if (b64Match) imageData = b64Match[0];
    }

    if (!imageData) {
      console.error("No image in response. Message:", JSON.stringify(msg).slice(0, 500));
      throw new Error("NO_IMAGE_IN_RESPONSE");
    }

    // Upload the equirectangular result
    let publicUrl: string;

    if (imageData.startsWith("data:")) {
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
      const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const storagePath = `stitched/${nodeId}/panorama.png`;

      const { error: uploadErr } = await supabase.storage
        .from("tour-uploads")
        .upload(storagePath, binaryData, { contentType: "image/png", upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("tour-uploads")
        .getPublicUrl(storagePath);

      publicUrl = urlData.publicUrl;
    } else {
      publicUrl = imageData;
    }

    console.log("HD equirectangular conversion complete:", publicUrl);

    // Update the node
    await supabase
      .from("tour_nodes")
      .update({
        stitched_panorama_url: publicUrl,
        stitch_status: "completed",
      })
      .eq("id", nodeId);

    return new Response(
      JSON.stringify({
        success: true,
        panorama_url: publicUrl,
        status: "completed",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Stitch panorama error:", error);

    const errMsg = error instanceof Error ? error.message : "Unknown error";

    if (nodeId) {
      await supabase
        .from("tour_nodes")
        .update({ stitch_status: "failed" })
        .eq("id", nodeId);
    }

    if (errMsg === "CREDITS_EXHAUSTED") {
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
