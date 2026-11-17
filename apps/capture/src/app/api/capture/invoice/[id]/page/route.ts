import { NextResponse } from "next/server";
import { safeStoragePath, UUID_PATTERN } from "@jvb/db/storage-path";
import { getSupabase, requireCapture } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID = new RegExp(`^${UUID_PATTERN}$`);

/** A page file of this invoice, where the upload route puts them; else null. */
function pagePath(path: unknown, invoiceId: string): string | null {
  return safeStoragePath(path, { pattern: new RegExp(`^invoices/${invoiceId}/[^/]+$`) });
}

/**
 * Record an uploaded invoice page. The screen draws its own small preview
 * from the photo it has, so no signed URL of the full-size original is sent
 * back to be downloaded again.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { id: invoiceId } = await params;
  if (!ID.test(invoiceId)) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { path?: unknown; pageNo?: unknown };
  const path = pagePath(body.path, invoiceId);
  if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 });
  const pageNo = typeof body.pageNo === "number" && Number.isInteger(body.pageNo) && body.pageNo > 0 ? body.pageNo : 1;

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("capture_invoice_pages")
    .insert({ invoice_id: invoiceId, storage_path: path, page_no: pageNo })
    .select("id, page_no")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ page: data });
}

/**
 * Attach the squared-up version the browser produced for a page. The squared
 * file it replaces (from an earlier reading) is removed, so a re-read leaves
 * no copy of the invoice behind.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { id: invoiceId } = await params;
  if (!ID.test(invoiceId)) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { pageId?: unknown; squaredPath?: unknown };
  const squaredPath = pagePath(body.squaredPath, invoiceId);
  if (typeof body.pageId !== "string" || !ID.test(body.pageId) || !squaredPath)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const supabase = await getSupabase();
  const { data: page } = await supabase
    .from("capture_invoice_pages")
    .select("id, storage_path, squared_path")
    .eq("id", body.pageId)
    .eq("invoice_id", invoiceId)
    .maybeSingle();
  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

  const { error } = await supabase
    .from("capture_invoice_pages")
    .update({ squared_path: squaredPath })
    .eq("id", page.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const previous = pagePath(page.squared_path, invoiceId);
  if (previous && previous !== squaredPath && previous !== page.storage_path) {
    await supabase.storage.from("captures").remove([previous]);
  }
  return NextResponse.json({ ok: true });
}
