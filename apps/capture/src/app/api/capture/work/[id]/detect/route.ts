import { NextResponse } from "next/server";
import { getSupabase, requireCapture } from "@/lib/supabase";
import { fetchImage, visionJson, isConfigured, type ImageInput } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM = `You are a cataloguing assistant for a London gallery of Japanese and Indian works of art. You are shown one or more photographs of a SINGLE object being acquired. One of the photos may be a WORK LABEL, gallery ticket, old collection label, auction lot slip, or a hand-written note describing the object. Read any such label.

Return ONLY a JSON object (no prose, no code fences) with exactly these keys:
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

type Detection = {
  label_found: boolean;
  label_image_index: number;
  maker: string;
  title: string;
  year: string;
  period: string;
  medium: string;
  dimensions: string;
  origin_region: string;
  category: string;
  notes: string;
};

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (!isConfigured()) return NextResponse.json({ configured: false });
  const { id: workId } = await params;

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

  let detection: Detection | null = null;
  try {
    detection = await visionJson<Detection>({
      system: SYSTEM,
      instruction:
        "Here are the photos of one object. Identify a work label if present and extract its details.",
      images,
      maxTokens: 1024,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI request failed";
    return NextResponse.json({ configured: true, error: message }, { status: 502 });
  }
  if (!detection) return NextResponse.json({ configured: true, label_found: false });

  // Prefill only the fields the label yielded; never clobber with blanks.
  const patch: Record<string, unknown> = { label_detected: detection.label_found, extracted: detection };
  const map: Record<string, string> = {
    maker: detection.maker,
    title: detection.title,
    year: detection.year,
    period: detection.period,
    medium: detection.medium,
    dimensions_text: detection.dimensions,
    origin_region: detection.origin_region,
    category: detection.category,
    notes: detection.notes,
  };
  for (const [k, v] of Object.entries(map)) if (v && v.trim()) patch[k] = v.trim();

  await supabase.from("capture_works").update(patch).eq("id", workId);

  // Flag which photo was the label.
  if (
    detection.label_found &&
    detection.label_image_index >= 0 &&
    detection.label_image_index < usedPhotoIds.length
  ) {
    await supabase
      .from("capture_photos")
      .update({ is_label: true })
      .eq("id", usedPhotoIds[detection.label_image_index]);
  }

  return NextResponse.json({ configured: true, ...detection });
}
