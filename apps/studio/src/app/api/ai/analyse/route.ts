import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { rateLimit } from "@jvb/db/rate-limit";
import { getSupabase, getSession, hasRole, createServiceClient } from "@/lib/supabase";
import { resolvePiece } from "@/lib/piece-store";
import { modelImageType, parseSuggestions, stopProblem, type ModelImageType, type Suggestions } from "@/lib/ai-suggestions";

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

/*
 * The answer's room. The default model runs adaptive thinking when the
 * request sets no `thinking`, and max_tokens caps thinking and answer
 * together, so 1,024 cut the JSON off on a detailed work. `thinking` stays
 * unset: "disabled" is refused (400) by the newer models AI_CATALOGUE_MODEL
 * may name. A non-streaming request of this size is well inside the SDK's
 * time limits.
 */
const MAX_TOKENS = 8000;

/*
 * The photograph sent: a rendition of the display master, not the master
 * itself (up to 4096 px, and several MB as a JPEG, where the API caps an
 * image at 5 MB and the model reads at most about 2,576 px on the long
 * side). Width only, so the proportions are kept; 2,560 keeps the detail of
 * signatures and box inscriptions.
 */
const IMAGE_WIDTH = 2560;
const IMAGE_QUALITY = 85;

/**
 * Per-person limit on analyses. One runs each time someone presses Analyse
 * on a work's edit page (nothing calls it automatically), and reviewing the
 * suggestions takes a minute or more, so two a minute for a whole hour is
 * never reached by hand; it only stops a loop running up the AI bill.
 */
const ANALYSES_PER_HOUR = 120;

/**
 * AI cataloguing suggestions for one work, from its first photograph. Only
 * admin and staff may ask (the roles that can edit a work, and so use them);
 * the suggestions are stored for review and never applied to fields here.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(session.roles, "admin", "staff"))
    return NextResponse.json({ error: "Only admin and staff can analyse a work" }, { status: 403 });
  const supabase = await getSupabase();

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

  // Counted per person just before the paid call, once there is an image to
  // send. The limiter lets the request through if its own check fails.
  if (!(await rateLimit(createServiceClient(), `ai-analyse:user:${session.user.id}`, 3600, ANALYSES_PER_HOUR)))
    return NextResponse.json(
      {
        configured: true,
        error: `That is ${ANALYSES_PER_HOUR} analyses in the last hour, the most allowed. Try again later.`,
      },
      { status: 429 },
    );

  const derivatives = supabase.storage.from("piece-derivatives");
  // The rendition first; the master itself only if the rendition cannot be
  // had (a storage without transforms), as before.
  const fetchImage = async (
    transform?: { width: number; quality: number },
  ): Promise<{ data: string; type: ModelImageType } | null> => {
    const { data: signed } = await derivatives.createSignedUrl(path, 60 * 5, transform ? { transform } : undefined);
    if (!signed?.signedUrl) return null;
    try {
      const res = await fetch(signed.signedUrl);
      // An error page (or anything the model cannot read) is not an image.
      const type = modelImageType(res.headers.get("content-type"));
      if (!res.ok || !type) return null;
      return { data: Buffer.from(await res.arrayBuffer()).toString("base64"), type };
    } catch {
      return null;
    }
  };
  const image =
    (await fetchImage({ width: IMAGE_WIDTH, quality: IMAGE_QUALITY })) ?? (await fetchImage());
  if (!image) return NextResponse.json({ error: "Could not fetch image" }, { status: 502 });

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
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: image.type,
                data: image.data,
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
    // A cut-off or refused turn is said as such, not as "could not parse".
    const problem = stopProblem(msg.stop_reason);
    if (problem) return NextResponse.json({ configured: true, error: problem }, { status: 502 });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    // Checked, not cast: lists of strings and strings, anything else dropped.
    suggestions = parseSuggestions(text);
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
