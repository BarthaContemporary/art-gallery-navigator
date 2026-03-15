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

    // Fetch the saved panorama strip
    const { data: node, error: nodeErr } = await supabase
      .from("tour_nodes")
      .select("panorama_strip_url")
      .eq("id", nodeId)
      .single();

    if (nodeErr) throw nodeErr;

    const stripUrl = node?.panorama_strip_url;
    if (!stripUrl) {
      throw new Error("No panorama strip found. Please save one in the Composer first.");
    }

    console.log("Processing panorama strip to equirectangular:", stripUrl);

    // The strip is already a wide horizontal panorama composed by the user.
    // The AI's job is ONLY to:
    // 1. Reproduce the strip content faithfully as the central horizon band
    // 2. Extend vertically (add ceiling/sky above and floor below) to achieve 2:1 aspect ratio
    // 3. Ensure left and right edges wrap seamlessly
    // We do NOT send reference images — they confuse the model and cause hallucination.
    const prompt = [
      "I need you to convert this wide panoramic photo strip into a standard equirectangular panorama image.",
      "",
      "CRITICAL RULES:",
      "- The provided image IS the panoramic scene. It must appear as the central horizontal band of the output, EXACTLY as-is.",
      "- DO NOT change, redraw, re-interpret, add, remove, or modify ANY objects, text, furniture, walls, colors, or details from the source.",
      "- DO NOT hallucinate or invent new content in the central band. Copy it faithfully.",
      "- ONLY generate new content for the TOP (ceiling/sky) and BOTTOM (floor/ground) areas that are not visible in the source strip.",
      "- The top and bottom extensions should be realistic continuations based on the visible scene context (e.g., if indoors, add a ceiling; if outdoors, add sky above and ground below).",
      "- The LEFT and RIGHT edges must connect seamlessly for 360° wrapping.",
      "- Output must be exactly 2:1 aspect ratio (width = 2× height) for equirectangular projection.",
      "- Make the output as high resolution as possible.",
      "- Output a single image only.",
    ].join("\n");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: stripUrl } },
            ],
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

    // Extract image from response — handle multiple response formats
    let imageData: string | null = null;

    if (msg?.images?.[0]?.image_url?.url) {
      imageData = msg.images[0].image_url.url;
    }

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

    if (!imageData && typeof msg?.content === "string") {
      const b64Match = msg.content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
      if (b64Match) imageData = b64Match[0];
    }

    if (!imageData) {
      console.error("No image in response. Message:", JSON.stringify(msg).slice(0, 500));
      throw new Error("NO_IMAGE_IN_RESPONSE");
    }

    // Download/decode and persist to storage
    let binaryData: Uint8Array;
    let contentType = "image/png";

    if (imageData.startsWith("data:")) {
      const mimeMatch = imageData.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
      contentType = mimeMatch?.[1] || "image/png";
      const base64Data = imageData.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
      binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    } else {
      const imageResp = await fetch(imageData);
      if (!imageResp.ok) {
        throw new Error(`Failed to download generated panorama: ${imageResp.status}`);
      }
      contentType = imageResp.headers.get("content-type") || "image/png";
      binaryData = new Uint8Array(await imageResp.arrayBuffer());
    }

    const fileExt = contentType.includes("jpeg") || contentType.includes("jpg")
      ? "jpg"
      : contentType.includes("webp")
        ? "webp"
        : "png";

    const storagePath = `stitched/${nodeId}/panorama.${fileExt}`;

    const { error: uploadErr } = await supabase.storage
      .from("tour-uploads")
      .upload(storagePath, binaryData, { contentType, upsert: true });

    if (uploadErr) throw uploadErr;

    const { data: urlData } = supabase.storage
      .from("tour-uploads")
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    console.log("Equirectangular panorama complete:", publicUrl, `(${binaryData.length} bytes)`);

    await supabase
      .from("tour_nodes")
      .update({
        stitched_panorama_url: publicUrl,
        stitch_status: "completed",
      })
      .eq("id", nodeId);

    return new Response(
      JSON.stringify({ success: true, panorama_url: publicUrl, status: "completed" }),
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
