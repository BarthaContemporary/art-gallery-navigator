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

  try {
    const { node_id } = await req.json();
    if (!node_id) throw new Error("node_id is required");

    // Mark as processing
    await supabase
      .from("tour_nodes")
      .update({ stitch_status: "processing" })
      .eq("id", node_id);

    // Fetch images for this node
    const { data: images, error: imgErr } = await supabase
      .from("tour_node_images")
      .select("id, original_url, medium_url, thumbnail_url, display_order")
      .eq("node_id", node_id)
      .order("display_order", { ascending: true });

    if (imgErr) throw imgErr;
    if (!images || images.length < 2) throw new Error("Need at least 2 images to stitch");

    // Limit to 6 images to stay within token limits
    const selectedImages = images.slice(0, 6);

    // Helper: attempt a single stitch call
    async function attemptStitch(imgs: typeof selectedImages): Promise<string> {
      // Build content: short instruction + images
      const content: any[] = [
        {
          type: "text",
          text: `Stitch these ${imgs.length} overlapping photos into a single wide seamless panoramic image. Blend the overlapping edges. Output one panoramic photograph.`,
        },
      ];
      for (const img of imgs) {
        content.push({
          type: "image_url",
          image_url: { url: img.medium_url || img.original_url },
        });
      }

      console.log(`Attempting stitch with ${imgs.length} images...`);

      const resp = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{ role: "user", content }],
            modalities: ["image", "text"],
          }),
        }
      );

      if (!resp.ok) {
        const errText = await resp.text();
        console.error("AI gateway error:", resp.status, errText);
        if (resp.status === 429) throw new Error("RATE_LIMITED");
        if (resp.status === 402) throw new Error("CREDITS_EXHAUSTED");
        throw new Error(`AI gateway error: ${resp.status}`);
      }

      const data = await resp.json();
      console.log("AI response keys:", JSON.stringify(Object.keys(data)));

      // Try multiple paths to find the generated image
      const msg = data.choices?.[0]?.message;

      // Path 1: images array (standard Lovable AI format)
      let imageUrl = msg?.images?.[0]?.image_url?.url;

      // Path 2: inline base64 in content (some models embed it)
      if (!imageUrl && typeof msg?.content === "string") {
        const b64Match = msg.content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
        if (b64Match) imageUrl = b64Match[0];
      }

      // Path 3: content array with image parts
      if (!imageUrl && Array.isArray(msg?.content)) {
        for (const part of msg.content) {
          if (part.type === "image_url") {
            imageUrl = part.image_url?.url;
            break;
          }
          if (part.type === "image" && part.image_url?.url) {
            imageUrl = part.image_url.url;
            break;
          }
        }
      }

      if (!imageUrl) {
        console.error("No image found in response:", JSON.stringify(data).slice(0, 800));
        throw new Error("NO_IMAGE_IN_RESPONSE");
      }

      return imageUrl;
    }

    // Try with all images first, then retry with fewer if it fails
    let generatedImage: string;
    try {
      generatedImage = await attemptStitch(selectedImages);
    } catch (e: any) {
      if (e.message === "RATE_LIMITED") {
        await supabase.from("tour_nodes").update({ stitch_status: "failed" }).eq("id", node_id);
        return new Response(
          JSON.stringify({ error: "Rate limited. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (e.message === "CREDITS_EXHAUSTED") {
        await supabase.from("tour_nodes").update({ stitch_status: "failed" }).eq("id", node_id);
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Retry with fewer images
      if (e.message === "NO_IMAGE_IN_RESPONSE" && selectedImages.length > 3) {
        console.log("Retrying with fewer images...");
        generatedImage = await attemptStitch(selectedImages.slice(0, 4));
      } else {
        throw e;
      }
    }

    // Upload the base64 image to Supabase storage
    const base64Data = generatedImage.replace(/^data:image\/\w+;base64,/, "");
    const binaryData = Uint8Array.from(atob(base64Data), (c) =>
      c.charCodeAt(0)
    );

    const storagePath = `stitched/${node_id}/panorama.png`;
    const { error: uploadErr } = await supabase.storage
      .from("tour-uploads")
      .upload(storagePath, binaryData, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadErr) {
      console.error("Storage upload error:", uploadErr);
      throw uploadErr;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("tour-uploads")
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;
    console.log("Stitched panorama uploaded:", publicUrl);

    // Update the node with the stitched URL
    await supabase
      .from("tour_nodes")
      .update({
        stitched_panorama_url: publicUrl,
        stitch_status: "completed",
      })
      .eq("id", node_id);

    return new Response(
      JSON.stringify({
        success: true,
        panorama_url: publicUrl,
        status: "completed",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Stitch panorama error:", error);

    // Try to mark as failed
    try {
      const { node_id } = await req.clone().json();
      if (node_id) {
        await supabase
          .from("tour_nodes")
          .update({ stitch_status: "failed" })
          .eq("id", node_id);
      }
    } catch {}

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
