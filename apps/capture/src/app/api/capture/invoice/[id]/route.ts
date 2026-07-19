import { NextResponse } from "next/server";
import { getSupabase, requireCapture } from "@/lib/supabase";

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
  if ("invoice_date" in body) {
    const d = str(body.invoice_date);
    patch.invoice_date = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
  }
  if ("total" in body) {
    const n = Number(body.total);
    patch.total = Number.isFinite(n) && String(body.total ?? "").trim() !== "" ? n : null;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

  const supabase = await getSupabase();
  const { error } = await supabase.from("capture_invoices").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

function str(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}
