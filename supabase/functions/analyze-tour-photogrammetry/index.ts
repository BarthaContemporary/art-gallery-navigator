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

  try {
    const { node_id } = await req.json();
    if (!node_id) throw new Error("node_id is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth user from request
    const authHeader = req.headers.get("Authorization");
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as processing
    await supabase.from("tour_3d_reconstructions").upsert(
      { node_id, status: "processing", camera_poses: null, error_message: null },
      { onConflict: "node_id" }
    );

    // Fetch node images
    const { data: images, error: imgErr } = await supabase
      .from("tour_node_images")
      .select("id, original_url, display_order, original_width, original_height")
      .eq("node_id", node_id)
      .order("display_order", { ascending: true });

    if (imgErr) throw imgErr;
    if (!images || images.length < 2) throw new Error("Need at least 2 images for 3D reconstruction");

    // Build image content array for Gemini vision
    const imageContents: any[] = [];
    
    // Add a text description listing all images
    let imageList = images.map((img: any, i: number) => 
      `Image ${i + 1} (id: ${img.id}, order: ${img.display_order}, ${img.original_width || '?'}x${img.original_height || '?'}px)`
    ).join("\n");

    // For each image, add it as a URL reference
    const imageMessages: any[] = [];
    for (const img of images) {
      imageMessages.push({
        type: "image_url",
        image_url: { url: img.original_url },
      });
    }

    const systemPrompt = `You are a photogrammetry analysis AI. You analyze overlapping photographs of a physical space and estimate the 3D camera positions and orientations for each image.

Given a set of photographs taken from different positions in a room/space, analyze:
1. Visual overlap between adjacent images
2. Perspective changes indicating camera movement
3. Depth cues from the scene geometry
4. Common features across images

Output a JSON object with:
- "camera_poses": array of objects, one per image, each with:
  - "image_id": the image ID provided
  - "x": estimated X position in meters (left-right)
  - "y": estimated Y position in meters (up-down, 0 = eye level)
  - "z": estimated Z position in meters (forward-backward)
  - "yaw": rotation around Y axis in degrees (0 = forward, positive = right)
  - "pitch": rotation around X axis in degrees (0 = level, positive = up)
  - "roll": rotation around Z axis in degrees (usually 0)
  - "fov": estimated field of view in degrees
  - "overlap_with_next": estimated overlap percentage with next image (0-100)
- "scene_config": object with:
  - "scene_type": "room" | "corridor" | "outdoor" | "facade"
  - "estimated_width_m": estimated scene width in meters
  - "estimated_depth_m": estimated scene depth
  - "camera_height_m": estimated camera height
  - "description": brief description of the space

Assume images are ordered sequentially as a walkthrough. Position the first camera at origin (0, 0, 0) facing forward (yaw=0). Estimate positions relative to first camera.

RESPOND WITH ONLY THE JSON OBJECT, no markdown, no code blocks.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze these ${images.length} photographs and estimate 3D camera positions.\n\n${imageList}\n\nThe images are sequential photos of an entrance/space. Estimate where each camera was positioned and oriented when each photo was taken.`,
              },
              ...imageMessages,
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      
      if (response.status === 429) {
        await supabase.from("tour_3d_reconstructions").update({
          status: "failed",
          error_message: "Rate limited. Please try again later.",
        }).eq("node_id", node_id);
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI analysis failed: ${response.status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content;

    if (!content) throw new Error("No response from AI");

    // Parse the JSON response (strip any markdown if present)
    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse spatial analysis");
    }

    // Store results
    const { error: updateErr } = await supabase.from("tour_3d_reconstructions").update({
      status: "completed",
      camera_poses: parsed.camera_poses,
      scene_config: parsed.scene_config,
      error_message: null,
    }).eq("node_id", node_id);

    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({
      success: true,
      camera_poses: parsed.camera_poses,
      scene_config: parsed.scene_config,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Photogrammetry analysis error:", error);

    // Try to update status to failed
    try {
      const { node_id } = await new Response(req.clone().body).json().catch(() => ({ node_id: null }));
      if (node_id) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabase.from("tour_3d_reconstructions").update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Unknown error",
        }).eq("node_id", node_id);
      }
    } catch {}

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
