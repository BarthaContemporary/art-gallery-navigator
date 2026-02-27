import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractJson(content: string): any {
  let cleaned = content
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const jsonStart = cleaned.search(/[\{\[]/);
  const jsonEnd = cleaned.lastIndexOf(jsonStart !== -1 && cleaned[jsonStart] === "[" ? "]" : "}");

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("No JSON object found in response");
  }

  cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  cleaned = cleaned
    .replace(/,\s*}/g, "}")
    .replace(/,\s*]/g, "]")
    .replace(/[\x00-\x1F\x7F]/g, "");

  return JSON.parse(cleaned);
}

async function processReconstruction(nodeId: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Fetch node images - use medium/thumbnail URLs for speed
    const { data: images, error: imgErr } = await supabase
      .from("tour_node_images")
      .select("id, original_url, medium_url, thumbnail_url, display_order, original_width, original_height")
      .eq("node_id", nodeId)
      .order("display_order", { ascending: true });

    if (imgErr) throw imgErr;
    if (!images || images.length < 2) throw new Error("Need at least 2 images for 3D reconstruction");

    // Limit to 6 images max for speed
    const selectedImages = images.slice(0, 6);

    // Use medium or thumbnail URLs for faster processing
    const imageMessages: any[] = selectedImages.map((img: any) => ({
      type: "image_url",
      image_url: { url: img.medium_url || img.thumbnail_url || img.original_url },
    }));

    const imageList = selectedImages
      .map((img: any, i: number) =>
        `Image ${i + 1} (id: ${img.id}, order: ${img.display_order}, ${img.original_width || "?"}x${img.original_height || "?"}px)`
      )
      .join("\n");

    const systemPrompt = `You are a photogrammetry analysis AI. Analyze overlapping photographs and estimate 3D camera positions.

Output a JSON object with:
- "camera_poses": array of objects, one per image:
  - "image_id": the image ID
  - "x": X position in meters (left-right)
  - "y": Y position in meters (up-down, 0 = eye level)
  - "z": Z position in meters (forward-backward)
  - "yaw": rotation around Y axis in degrees
  - "pitch": rotation around X axis in degrees
  - "roll": rotation around Z axis in degrees (usually 0)
  - "fov": estimated field of view in degrees
  - "overlap_with_next": overlap percentage with next image (0-100)
- "scene_config": object with:
  - "scene_type": "room" | "corridor" | "outdoor" | "facade"
  - "estimated_width_m": estimated scene width in meters
  - "estimated_depth_m": estimated scene depth
  - "camera_height_m": estimated camera height
  - "description": brief description of the space

Position first camera at origin (0,0,0) facing forward (yaw=0).
RESPOND WITH ONLY THE JSON OBJECT.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze these ${selectedImages.length} photographs and estimate 3D camera positions.\n\n${imageList}`,
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
      throw new Error(response.status === 429 ? "Rate limited. Please try again later." : `AI analysis failed: ${response.status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content;
    if (!content) throw new Error("No response from AI");

    const parsed = extractJson(content);

    await supabase.from("tour_3d_reconstructions").update({
      status: "completed",
      camera_poses: parsed.camera_poses,
      scene_config: parsed.scene_config,
      error_message: null,
    }).eq("node_id", nodeId);

    console.log("Reconstruction completed for node:", nodeId);
  } catch (error) {
    console.error("Reconstruction error:", error);
    await supabase.from("tour_3d_reconstructions").update({
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error",
    }).eq("node_id", nodeId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { node_id } = await req.json();
    if (!node_id) throw new Error("node_id is required");

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

    // Fire and forget - start processing in background
    // Use EdgeRuntime.waitUntil if available, otherwise just don't await
    const processingPromise = processReconstruction(node_id);
    
    // Try to use waitUntil for reliable background processing
    try {
      (globalThis as any).EdgeRuntime?.waitUntil?.(processingPromise);
    } catch {
      // Fallback: the promise will run but may be cut short
      processingPromise.catch((e) => console.error("Background processing error:", e));
    }

    // Return immediately
    return new Response(JSON.stringify({
      success: true,
      status: "processing",
      message: "3D reconstruction started. Poll for status.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Photogrammetry error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
