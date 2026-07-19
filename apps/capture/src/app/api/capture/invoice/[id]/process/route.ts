import { NextResponse } from "next/server";
import { getSupabase, requireCapture } from "@/lib/supabase";
import { fetchImage, visionJson, isConfigured, type ImageInput } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM = `You read photographed invoices for a London art gallery. You are shown the pages of ONE invoice, in order. Two jobs:

1. For EACH page image, give the geometry needed to square it up (deskew + crop to the document): its clockwise rotation in degrees and the tight bounding box of the paper as fractions (0-1) of the image.
2. Extract the invoice header data from across all pages.

Return ONLY a JSON object (no prose, no code fences):
{
  "pages": [
    { "rotate_deg": number, "crop": { "x": number, "y": number, "w": number, "h": number } }
  ],                              // one entry per page, same order as shown
  "vendor": string,               // who issued the invoice, else ""
  "reference": string,            // invoice number / reference, else ""
  "invoice_date": string,         // ISO yyyy-mm-dd if determinable, else ""
  "total": string,                // grand total as digits only e.g. "1250.00", else ""
  "currency": string              // ISO code e.g. "GBP","USD","EUR","JPY", else ""
}
rotate_deg is how many degrees to rotate the image CLOCKWISE to make text upright (usually between -15 and 15, but can be 90/180/270 for sideways photos). crop defaults to the full frame {x:0,y:0,w:1,h:1} if the paper fills the photo. Transcribe values; never invent a total or date.`;

type Geo = { rotate_deg: number; crop: { x: number; y: number; w: number; h: number } };
type Extract = {
  pages: Geo[];
  vendor: string;
  reference: string;
  invoice_date: string;
  total: string;
  currency: string;
};

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (!isConfigured()) return NextResponse.json({ configured: false });
  const { id: invoiceId } = await params;

  const supabase = await getSupabase();
  const { data: pages } = await supabase
    .from("capture_invoice_pages")
    .select("id, storage_path, page_no")
    .eq("invoice_id", invoiceId)
    .order("page_no");

  const list = (pages ?? []).slice(0, 8);
  if (list.length === 0) return NextResponse.json({ configured: true, pages: [] });

  const images: ImageInput[] = [];
  const pageIds: string[] = [];
  for (const p of list) {
    const { data: signed } = await supabase.storage.from("captures").createSignedUrl(p.storage_path, 60 * 5);
    if (!signed?.signedUrl) continue;
    const img = await fetchImage(signed.signedUrl);
    if (img) {
      images.push(img);
      pageIds.push(p.id);
    }
  }
  if (images.length === 0) return NextResponse.json({ configured: true, pages: [] });

  let out: Extract | null = null;
  try {
    out = await visionJson<Extract>({
      system: SYSTEM,
      instruction: "Here are the invoice pages in order. Return geometry per page and the extracted header.",
      images,
      maxTokens: 1500,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI request failed";
    return NextResponse.json({ configured: true, error: message }, { status: 502 });
  }
  if (!out) return NextResponse.json({ configured: true, pages: [] });

  // Persist extracted header (only non-empty values).
  const patch: Record<string, unknown> = { extracted: out };
  if (out.vendor?.trim()) patch.vendor = out.vendor.trim();
  if (out.reference?.trim()) patch.reference = out.reference.trim();
  if (out.currency?.trim()) patch.currency = out.currency.trim().toUpperCase();
  if (out.invoice_date && /^\d{4}-\d{2}-\d{2}$/.test(out.invoice_date)) patch.invoice_date = out.invoice_date;
  const total = Number((out.total ?? "").replace(/[^0-9.]/g, ""));
  if (Number.isFinite(total) && total > 0) patch.total = total;
  await supabase.from("capture_invoices").update(patch).eq("id", invoiceId);

  // Return geometry keyed by page id for the client to square up.
  const geometry = pageIds.map((pid, i) => ({ pageId: pid, geo: out!.pages?.[i] ?? null }));
  return NextResponse.json({
    configured: true,
    geometry,
    vendor: patch.vendor ?? "",
    reference: patch.reference ?? "",
    invoice_date: patch.invoice_date ?? "",
    total: patch.total ?? "",
    currency: patch.currency ?? "",
  });
}
