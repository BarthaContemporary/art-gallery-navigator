import { NextResponse } from "next/server";
import { getSupabase, requireCapture } from "@/lib/supabase";
import { isBlank, isoDate, parseAmount } from "@/lib/capture-values";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Autosave invoice header fields. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  if ("vendor" in body) patch.vendor = str(body.vendor);
  if ("reference" in body) patch.reference = str(body.reference);
  if ("notes" in body) patch.notes = str(body.notes);
  if ("currency" in body) patch.currency = str(body.currency);
  if ("invoice_date" in body) patch.invoice_date = isoDate(body.invoice_date);
  // Typed on a phone, "1,250.00", "1250,50" and "£1250" are all amounts
  // (lib/capture-values.ts). One that cannot be read without guessing is
  // refused with a message, never stored as nothing while the screen still
  // shows it; the other fields are saved all the same.
  let totalError: string | null = null;
  if ("total" in body) {
    if (isBlank(body.total)) patch.total = null;
    else {
      const n = parseAmount(body.total, "currency" in body ? str(body.currency) : null);
      if (n === null) totalError = `Could not read the total “${String(body.total).slice(0, 40)}”. Type it as 1250.50.`;
      else patch.total = n;
    }
  }

  if (Object.keys(patch).length) {
    const supabase = await getSupabase();
    const { error } = await supabase.from("capture_invoices").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (totalError) return NextResponse.json({ error: totalError }, { status: 400 });
  return NextResponse.json({ ok: true });
}

/** Delete an invoice, its pages, links, and stored page images. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { id } = await params;

  const supabase = await getSupabase();
  const { data: pages } = await supabase
    .from("capture_invoice_pages")
    .select("storage_path, squared_path")
    .eq("invoice_id", id);
  const paths = (pages ?? [])
    .flatMap((p) => [p.storage_path, p.squared_path])
    .filter((v): v is string => Boolean(v));
  if (paths.length) await supabase.storage.from("captures").remove(paths);

  // Rows (pages + links) cascade from the invoice FK.
  const { error } = await supabase.from("capture_invoices").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

function str(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}
