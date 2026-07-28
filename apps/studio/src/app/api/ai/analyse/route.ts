import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";
import { resolvePiece } from "@/lib/piece-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM = `You are a cataloguing assistant for a London gallery of Japanese and Indian works of art (bronzes, metalwork, okimono, tantric drawings, Mingei, 20th-century Japanese design). You are shown a photograph of one object and any known catalogue details. Propose cataloguing metadata.

Return ONLY a JSON object (no prose, no code fences) with exactly these keys:
{
  "hashtags": string[],          // 5-12 lowercase #tags: object type, material, technique, motif, style/period, e.g. "#okimono", "#bronze", "#shibuichi", "#dragon", "#meiji"
  "object_type": string,          // e.g. "okimono", "vase", "screen", "drawing"
  "materials": string[],          // e.g. ["bronze", "silver inlay"]
  "techniques": string[],         // e.g. ["lost-wax casting", "nunome-zōgan"]
  "motifs": string[],             // e.g. ["dragon", "waves"]
  "suggested_category": string,   // best single category
  "suggested_medium": string,     // a medium line, e.g. "Bronze with silver and shakudō inlay"
  "suggested_period": string,     // best guess, e.g. "Meiji (1868-1912)" or "" if unclear
  "description_draft": string     // 2-4 sentence catalogue description; hedge visual guesses ("apparently", "in the manner of")
}
Be specific but conservative — these are review-and-accept proposals, never final. Prefer "" or [] over guessing wildly.`;

type Suggestions = {
  hashtags: string[];
  object_type: string;
  materials: string[];
  techniques: string[];
  motifs: string[];
  suggested_category: string;
  suggested_medium: string;
  suggested_period: string;
  description_draft: string;
};

function parseJson(text: string): Suggestions | null {
  const cleaned = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Suggestions;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ configured: false });

  let stock: string;
  try {
    stock = String(((await req.json()) as { stock?: string }).stock ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!stock) return NextResponse.json({ error: "Missing stock" }, { status: 400 });

  const ref = await resolvePiece(supabase, stock);
  const { data: pieceData } = ref
    ? await supabase
        .from(ref.table)
        .select("id, title, period, medium, maker:makers ( display_name )")
        .eq("id", ref.id)
        .maybeSingle()
    : { data: null };
  const piece = pieceData as unknown as {
    id: string;
    title: string | null;
    period: string | null;
    medium: string | null;
    maker: { display_name: string | null } | null;
  } | null;
  if (!piece) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Primary image → signed URL → bytes.
  const { data: imgs } = await supabase
    .from("piece_images")
    .select("role, sort_order, storage_path_display, processing_status")
    .eq("piece_id", piece.id)
    .not("storage_path_display", "is", null);
  const usable = (imgs ?? [])
    .filter((i) => i.storage_path_display && i.processing_status !== "error")
    .sort(
      (a, b) =>
        (a.role === "front" ? 0 : 1) - (b.role === "front" ? 0 : 1) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
  const path = usable[0]?.storage_path_display as string | undefined;
  if (!path) {
    return NextResponse.json({
      configured: true,
      suggestions: null,
      message: "No processed image to analyse yet.",
    });
  }

  const { data: signed } = await supabase.storage
    .from("piece-derivatives")
    .createSignedUrl(path, 60 * 5);
  const url = signed?.signedUrl;
  if (!url)
    return NextResponse.json({ error: "Could not read image" }, { status: 500 });

  let base64: string;
  let mediaType = "image/jpeg";
  try {
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    base64 = buf.toString("base64");
    const ct = res.headers.get("content-type");
    if (ct?.startsWith("image/")) mediaType = ct.split(";")[0] ?? mediaType;
  } catch {
    return NextResponse.json({ error: "Could not fetch image" }, { status: 502 });
  }

  const context = [
    piece.title ? `Title: ${piece.title}` : null,
    piece.maker?.display_name ? `Maker: ${piece.maker.display_name}` : null,
    piece.period ? `Period (known): ${piece.period}` : null,
    piece.medium ? `Medium (known): ${piece.medium}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const anthropic = new Anthropic({ apiKey });
  let suggestions: Suggestions | null = null;
  try {
    const msg = await anthropic.messages.create({
      model: process.env.AI_CATALOGUE_MODEL ?? "claude-sonnet-5",
      max_tokens: 1024,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as
                  | "image/jpeg"
                  | "image/png"
                  | "image/gif"
                  | "image/webp",
                data: base64,
              },
            },
            {
              type: "text",
              text: `Catalogue this object.${context ? `\n\nKnown details:\n${context}` : ""}`,
            },
          ],
        },
      ],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    suggestions = parseJson(text);
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI request failed";
    return NextResponse.json({ configured: true, error: message }, { status: 502 });
  }

  if (!suggestions)
    return NextResponse.json(
      { configured: true, error: "Could not parse suggestions" },
      { status: 502 },
    );

  // Persist for audit / re-review (never auto-applied to fields).
  await supabase
    .from(ref!.table)
    .update({
      ai_suggestions: {
        ...suggestions,
        model: process.env.AI_CATALOGUE_MODEL ?? "claude-sonnet-5",
        generated_at: new Date().toISOString(),
      },
    })
    .eq("id", piece.id);

  return NextResponse.json({ configured: true, suggestions });
}
