import { NextResponse } from "next/server";
import { getSupabase, requireCapture } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Replace the set of works / inventory pieces this invoice covers. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { id: invoiceId } = await params;
  const body = (await req.json().catch(() => ({}))) as { workIds?: string[]; pieceIds?: string[] };

  const workIds = Array.isArray(body.workIds) ? body.workIds.filter(Boolean) : [];
  const pieceIds = Array.isArray(body.pieceIds) ? body.pieceIds.filter(Boolean) : [];

  const supabase = await getSupabase();
  await supabase.from("capture_invoice_links").delete().eq("invoice_id", invoiceId);

  const rows = [
    ...workIds.map((work_id) => ({ invoice_id: invoiceId, work_id, piece_id: null })),
    ...pieceIds.map((piece_id) => ({ invoice_id: invoiceId, work_id: null, piece_id })),
  ];
  if (rows.length) {
    const { error } = await supabase.from("capture_invoice_links").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, links: rows.length });
}
