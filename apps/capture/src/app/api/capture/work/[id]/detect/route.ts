import { NextResponse } from "next/server";
import { getSupabase, requireCapture } from "@/lib/supabase";
import { AiReplyError, fetchImage, visionJson, isConfigured, type ImageInput } from "@/lib/anthropic";
import { text } from "@/lib/capture-values";
import { aiLimitResponse } from "@/lib/ai-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = `You are a cataloguing assistant for a London gallery of Japanese and Indian works of art. You are shown one or more photographs of a SINGLE object being acquired. One of the photos may be a WORK LABEL, gallery ticket, old collection label, auction lot slip, or a hand-written note describing the object. Read any such label.

Return ONLY a JSON object (no prose, no code fences) with exactly these keys, every value a string except label_found and label_image_index:
{
  "label_found": boolean,          // true if any image is a label/ticket/description card
  "label_image_index": number,     // 0-based index of the label image, or -1
  "maker": string,                 // artist / workshop, else ""
  "title": string,                 // object title, else ""
  "year": string,                  // year or date, else ""
  "period": string,                // e.g. "Meiji (1868-1912)", else ""
  "medium": string,                // materials/medium line, else ""
  "dimensions": string,            // verbatim dimensions as written, else ""
  "origin_region": string,         // e.g. "Japan", "India", else ""
  "category": string,              // best single category, else ""
  "notes": string                  // any other useful text from the label, else ""
}
Transcribe what the label actually says — do not invent. Prefer "" over guessing. If no label is present, set label_found=false, label_image_index=-1 and extract nothing.`;

/** Reply key → capture_works column. */
const COLUMNS: Record<string, string> = {
  maker: "maker",
  title: "title",
  year: "year",
  period: "period",
  medium: "medium",
  dimensions: "dimensions_text",
  origin_region: "origin_region",
  category: "category",
  notes: "notes",
};

/**
 * Read a work's label from its photos and prefill the work. With
 * { mode: "auto" } (the read the capture screen starts by itself after
 * photos arrive) only empty columns are filled, so nothing typed meanwhile is
 * replaced; the explicit "Re-read label" sends no mode and fills every column
 * the label yields. Blanks never clear a column.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (!isConfigured()) return NextResponse.json({ configured: false });
  const limited = await aiLimitResponse(gate.session.user.id, "detect");
  if (limited) return limited;
  const { id: workId } = await params;
  const body = (await req.json().catch(() => ({}))) as { mode?: unknown };
  const auto = body.mode === "auto";

  const supabase = await getSupabase();
  const { data: photos } = await supabase
    .from("capture_photos")
    .select("id, storage_path")
    .eq("work_id", workId)
    .order("sort_order")
    .order("created_at");

  const list = (photos ?? []).slice(0, 8); // cap tokens
  if (list.length === 0) return NextResponse.json({ configured: true, label_found: false });

  const images: ImageInput[] = [];
  const usedPhotoIds: string[] = [];
  for (const p of list) {
    const { data: signed } = await supabase.storage
      .from("captures")
      .createSignedUrl(p.storage_path, 60 * 5);
    if (!signed?.signedUrl) continue;
    const img = await fetchImage(signed.signedUrl);
    if (img) {
      images.push(img);
      usedPhotoIds.push(p.id);
    }
  }
  if (images.length === 0) return NextResponse.json({ configured: true, label_found: false });

  let reply: Record<string, unknown> | null = null;
  try {
    reply = await visionJson({
      system: SYSTEM,
      instruction:
        "Here are the photos of one object. Identify a work label if present and extract its details.",
      images,
      maxTokens: 2048,
    });
  } catch (e) {
    if (!(e instanceof AiReplyError)) console.error("capture label read:", e instanceof Error ? e.message : e);
    const message = e instanceof AiReplyError ? e.message : "The label could not be read. Try again.";
    return NextResponse.json({ configured: true, error: message }, { status: 502 });
  }
  if (!reply) return NextResponse.json({ configured: true, label_found: false });

  // The reply is model output: every value is checked before it is used.
  const labelFound = reply.label_found === true;
  const index = typeof reply.label_image_index === "number" ? reply.label_image_index : -1;
  const labelPhotoId =
    labelFound && Number.isInteger(index) && index >= 0 && index < usedPhotoIds.length ? usedPhotoIds[index]! : null;
  const found: Record<string, string> = {};
  for (const key of Object.keys(COLUMNS)) {
    const v = text(reply[key]);
    if (v) found[key] = v;
  }

  const patch: Record<string, unknown> = { label_detected: labelFound, extracted: reply };
  let current: Record<string, unknown> = {};
  if (auto) {
    const { data } = await supabase
      .from("capture_works")
      .select(Object.values(COLUMNS).join(", "))
      .eq("id", workId)
      .maybeSingle();
    current = (data ?? {}) as Record<string, unknown>;
  }
  for (const [key, v] of Object.entries(found)) {
    const column = COLUMNS[key]!;
    if (auto && String(current[column] ?? "").trim() !== "") continue;
    patch[column] = v;
  }
  await supabase.from("capture_works").update(patch).eq("id", workId);

  // One label photo per work: the latest reading decides which.
  await supabase.from("capture_photos").update({ is_label: false }).eq("work_id", workId).eq("is_label", true);
  if (labelPhotoId) await supabase.from("capture_photos").update({ is_label: true }).eq("id", labelPhotoId);

  return NextResponse.json({ configured: true, label_found: labelFound, label_photo_id: labelPhotoId, ...found });
}
