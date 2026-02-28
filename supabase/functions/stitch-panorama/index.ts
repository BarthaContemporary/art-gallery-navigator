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

    // Fetch images for this node
    const { data: images, error: imgErr } = await supabase
      .from("tour_node_images")
      .select("id, original_url, medium_url, thumbnail_url, display_order")
      .eq("node_id", nodeId)
      .order("display_order", { ascending: true });

    if (imgErr) throw imgErr;
    if (!images || images.length < 2) throw new Error("Need at least 2 images to stitch");

    const selectedImages = images.slice(0, 10);
    const totalSteps = selectedImages.length - 1;

    console.log(`Starting pairwise stitch: ${selectedImages.length} images, ${totalSteps} steps`);

    // Helper: call AI to merge two images
    async function mergeTwo(imageUrl1: string, imageUrl2: string, stepNum: number): Promise<string> {
      const content: any[] = [
        {
          type: "text",
          text: "Seamlessly merge these two overlapping photographs into one wider panoramic image. Preserve all detail and natural lighting. Output a single photograph.",
        },
        { type: "image_url", image_url: { url: imageUrl1 } },
        { type: "image_url", image_url: { url: imageUrl2 } },
      ];

      console.log(`Step ${stepNum}/${totalSteps}: Merging...`);

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`Step ${stepNum} AI error:`, resp.status, errText);
        if (resp.status === 429) throw new Error("RATE_LIMITED");
        if (resp.status === 402) throw new Error("CREDITS_EXHAUSTED");
        throw new Error(`AI gateway error: ${resp.status}`);
      }

      const data = await resp.json();
      const msg = data.choices?.[0]?.message;

      // Extract image from response - try multiple paths
      let imageData: string | null = null;

      // Path 1: inline_data in content array
      if (Array.isArray(msg?.content)) {
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

      // Path 2: base64 in content string
      if (!imageData && typeof msg?.content === "string") {
        const b64Match = msg.content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
        if (b64Match) imageData = b64Match[0];
      }

      // Path 3: images array
      if (!imageData && msg?.images?.[0]?.image_url?.url) {
        imageData = msg.images[0].image_url.url;
      }

      if (!imageData) {
        console.error(`Step ${stepNum}: No image in response. Keys:`, JSON.stringify(Object.keys(data)));
        console.error(`Message structure:`, JSON.stringify(msg).slice(0, 500));
        throw new Error("NO_IMAGE_IN_RESPONSE");
      }

      return imageData;
    }

    // Helper: upload base64 image to storage, return public URL
    async function uploadStep(base64OrUrl: string, stepName: string): Promise<string> {
      let base64Data: string;
      if (base64OrUrl.startsWith("data:")) {
        base64Data = base64OrUrl.replace(/^data:image\/\w+;base64,/, "");
      } else {
        // It's a URL - return as-is
        return base64OrUrl;
      }

      const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const storagePath = `stitched/${nodeId}/${stepName}.png`;

      const { error: uploadErr } = await supabase.storage
        .from("tour-uploads")
        .upload(storagePath, binaryData, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadErr) {
        console.error(`Upload error for ${stepName}:`, uploadErr);
        throw uploadErr;
      }

      const { data: urlData } = supabase.storage
        .from("tour-uploads")
        .getPublicUrl(storagePath);

      return urlData.publicUrl;
    }

    // Pairwise iterative stitching
    let currentUrl = selectedImages[0].medium_url || selectedImages[0].original_url;

    for (let i = 1; i < selectedImages.length; i++) {
      const nextUrl = selectedImages[i].medium_url || selectedImages[i].original_url;

      let mergedImage: string;
      try {
        mergedImage = await mergeTwo(currentUrl, nextUrl, i);
      } catch (e: any) {
        if (e.message === "RATE_LIMITED") {
          // Wait and retry once
          console.log(`Rate limited at step ${i}, waiting 5s...`);
          await new Promise((r) => setTimeout(r, 5000));
          mergedImage = await mergeTwo(currentUrl, nextUrl, i);
        } else if (e.message === "NO_IMAGE_IN_RESPONSE") {
          // Retry once
          console.log(`No image at step ${i}, retrying after 3s...`);
          await new Promise((r) => setTimeout(r, 3000));
          try {
            mergedImage = await mergeTwo(currentUrl, nextUrl, i);
          } catch {
            // Use current result as final
            console.log(`Step ${i} failed twice, using partial result`);
            break;
          }
        } else if (e.message === "CREDITS_EXHAUSTED") {
          await supabase.from("tour_nodes").update({ stitch_status: "failed" }).eq("id", nodeId);
          return new Response(
            JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          throw e;
        }
      }

      // Upload intermediate result
      currentUrl = await uploadStep(mergedImage, `step_${i}`);
      console.log(`Step ${i}/${totalSteps} complete`);

      // Rate limit delay between steps
      if (i < selectedImages.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    // Upload final panorama
    const finalPath = `stitched/${nodeId}/panorama.png`;

    // If currentUrl is already a storage URL, just use it; otherwise download and re-upload
    let publicUrl = currentUrl;
    if (!currentUrl.includes(`stitched/${nodeId}/panorama.png`)) {
      // Copy the last step as the final panorama
      // If it's a base64 URL, upload it
      if (currentUrl.startsWith("data:")) {
        publicUrl = await uploadStep(currentUrl, "panorama");
      } else {
        // It's already a public URL from a step - just use it
        publicUrl = currentUrl;
      }
    }

    console.log("Pairwise stitching complete:", publicUrl);

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
        steps_completed: totalSteps,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Stitch panorama error:", error);

    if (nodeId) {
      await supabase
        .from("tour_nodes")
        .update({ stitch_status: "failed" })
        .eq("id", nodeId);
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
