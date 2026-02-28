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

    // Send all images (up to 10)
    const selectedImages = images.slice(0, 10);

    // Build multimodal message - put instruction FIRST, then images in order
    const imageContent: any[] = [
      {
        type: "text",
        text: `I have ${selectedImages.length} overlapping photographs taken from the SAME fixed position by rotating the camera clockwise to capture a full 360° panoramic view. The images are provided in sequential order (image 1 is the leftmost, image ${selectedImages.length} is the rightmost, and image ${selectedImages.length} overlaps back with image 1 to complete the 360° loop).

YOUR TASK: Stitch ALL ${selectedImages.length} images together into ONE single wide seamless equirectangular panoramic image.

CRITICAL REQUIREMENTS:
1. Use EVERY image provided - do not skip any. Each image contributes a unique section of the panorama.
2. Find the overlapping regions between consecutive images and blend them seamlessly.
3. The output MUST be a single ultra-wide panoramic image in equirectangular projection (2:1 aspect ratio).
4. Maintain photographic realism - do NOT generate new content, only merge what is in the photos.
5. Match exposure, color balance, and white point across all images for a seamless result.
6. The panorama should cover the full 360° horizontal field of view.
7. Make the output as high resolution as possible.

Generate the stitched panoramic image now.`,
      },
    ];

    // Add all images in order
    for (const img of selectedImages) {
      imageContent.push({
        type: "image_url",
        image_url: {
          url: img.medium_url || img.original_url,
        },
      });
    }

    console.log(`Sending ${selectedImages.length} images to AI for stitching...`);

    // Call Lovable AI gateway with image generation model
    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          messages: [
            {
              role: "user",
              content: imageContent,
            },
          ],
          modalities: ["image", "text"],
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        await supabase
          .from("tour_nodes")
          .update({ stitch_status: "failed" })
          .eq("id", node_id);
        return new Response(
          JSON.stringify({ error: "Rate limited. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        await supabase
          .from("tour_nodes")
          .update({ stitch_status: "failed" })
          .eq("id", node_id);
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("AI response received, checking for image...");

    // Extract the generated image
    const generatedImage =
      aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!generatedImage) {
      console.error("No image in AI response:", JSON.stringify(aiData).slice(0, 500));
      throw new Error("AI did not return a stitched image");
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
