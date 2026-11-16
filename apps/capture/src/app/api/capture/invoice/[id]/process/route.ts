import { NextResponse } from "next/server";
import { getSupabase, requireCapture } from "@/lib/supabase";
import { AiReplyError, fetchImage, visionJson, isConfigured, type ImageInput } from "@/lib/anthropic";
import { isoDate, parseAmount, sanitiseGeo, text } from "@/lib/capture-values";
import { aiLimitResponse } from "@/lib/ai-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = `You read photographed invoices for a London art gallery. You are shown the pages of ONE invoice, in order. Two jobs:

1. For EACH page image, give the geometry needed to square it up (deskew + crop to the document): its clockwise rotation in degrees and the tight bounding box of the paper as fractions (0-1) of the photo exactly as you are shown it, before any rotation.
2. Extract the invoice header data from across all pages.

Return ONLY a JSON object (no prose, no code fences):
{
  "pages": [
    { "rotate_deg": number, "crop": { "x": number, "y": number, "w": number, "h": number } }
  ],                              // one entry per page, same order as shown
  "vendor": string,               // who issued the invoice, else ""
  "reference": string,            // invoice number / reference, else ""
  "invoice_date": string,         // ISO yyyy-mm-dd if determinable, else ""
  "total": string,                // grand total as a plain number, "." for decimals, no grouping, e.g. "1250.00", else ""
  "currency": string              // ISO code e.g. "GBP","USD","EUR","JPY", else ""
}
rotate_deg is how many degrees to rotate the image CLOCKWISE to make text upright (usually between -15 and 15, but can be 90/180/270 for sideways photos). crop is measured on the photo as shown (the paper is cut out first, then turned upright): x and y are the paper's left and top edges, w and h its width and height, all fractions of the photo's width and height, never pixels or percent. crop defaults to the full frame {x:0,y:0,w:1,h:1} if the paper fills the photo. Transcribe values; never invent a total or date.`;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (!isConfigured()) return NextResponse.json({ configured: false });
  const limited = await aiLimitResponse(gate.session.user.id, "invoice");
  if (limited) return limited;
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

  let out: Record<string, unknown> | null = null;
  try {
    out = await visionJson({
      system: SYSTEM,
      instruction: "Here are the invoice pages in order. Return geometry per page and the extracted header.",
      images,
      maxTokens: 2048,
    });
  } catch (e) {
    if (!(e instanceof AiReplyError)) console.error("capture invoice read:", e instanceof Error ? e.message : e);
    const message = e instanceof AiReplyError ? e.message : "The invoice could not be read. Try again.";
    return NextResponse.json({ configured: true, error: message }, { status: 502 });
  }
  if (!out) return NextResponse.json({ configured: true, pages: [] });

  // The reply is model output: every value is checked before it is stored.
  const patch: Record<string, unknown> = { extracted: out };
  const vendor = text(out.vendor);
  const reference = text(out.reference);
  const currency = text(out.currency).toUpperCase();
  const invoiceDate = isoDate(out.invoice_date);
  const total = parseAmount(out.total, currency);
  if (vendor) patch.vendor = vendor;
  if (reference) patch.reference = reference;
  if (/^[A-Z]{3}$/.test(currency)) patch.currency = currency;
  if (invoiceDate) patch.invoice_date = invoiceDate;
  if (total !== null && total > 0) patch.total = total;
  const { error } = await supabase.from("capture_invoices").update(patch).eq("id", invoiceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Geometry keyed by page id for the client to square up: only boxes that
  // make sense (fractions of the photo, not slivers); null keeps the original.
  const pagesOut = Array.isArray(out.pages) ? out.pages : [];
  const geometry = pageIds.map((pid, i) => ({ pageId: pid, geo: sanitiseGeo(pagesOut[i]) }));
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
