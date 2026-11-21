import { NextResponse } from "next/server";
import { UUID_PATTERN } from "@jvb/db/storage-path";
import { createServiceClient, getSupabase, hasRole, requireCapture } from "@/lib/supabase";
import { attachInvoiceToPiece, invoiceItemCount } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Attaching copies the invoice page to each existing stock record.
export const maxDuration = 60;

const ID = new RegExp(`^${UUID_PATTERN}$`);
const ids = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && ID.test(x)))] : [];

/**
 * Set the works / inventory pieces this invoice covers. Only the links that
 * changed are removed or added, so a failed save never loses the others. A
 * captured work receives the invoice when it is pushed. An existing stock
 * record receives it now when an admin saves: the first page as its
 * purchase-invoice document, and the purchase date and cost only where the
 * record has none. A staff save only links: staff may not add purchase
 * invoices or figures to a stock record (no policy on piece_financials or
 * invoice documents), and the ids come from the request, so the service
 * role must not do it for them. The answer's `forAdmin` counts those.
 * Removing a link leaves a document or figures already attached in place.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { id: invoiceId } = await params;
  if (!ID.test(invoiceId)) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { workIds?: unknown; pieceIds?: unknown };
  const workIds = ids(body.workIds);
  const pieceIds = ids(body.pieceIds);

  const supabase = await getSupabase();
  const { data: invoice } = await supabase
    .from("capture_invoices")
    .select("id, vendor, invoice_date, total, currency")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const { data: current, error: readErr } = await supabase
    .from("capture_invoice_links")
    .select("work_id, piece_id")
    .eq("invoice_id", invoiceId);
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  const rows = (current ?? []) as { work_id: string | null; piece_id: string | null }[];
  const haveWorks = new Set(rows.map((r) => r.work_id).filter((v): v is string => Boolean(v)));
  const havePieces = new Set(rows.map((r) => r.piece_id).filter((v): v is string => Boolean(v)));

  const add = [
    ...workIds.filter((w) => !haveWorks.has(w)).map((work_id) => ({ invoice_id: invoiceId, work_id, piece_id: null })),
    ...pieceIds.filter((p) => !havePieces.has(p)).map((piece_id) => ({ invoice_id: invoiceId, work_id: null, piece_id })),
  ];
  if (add.length) {
    const { error } = await supabase.from("capture_invoice_links").insert(add);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const dropWorks = [...haveWorks].filter((w) => !workIds.includes(w));
  const dropPieces = [...havePieces].filter((p) => !pieceIds.includes(p));
  if (dropWorks.length) {
    const { error } = await supabase
      .from("capture_invoice_links")
      .delete()
      .eq("invoice_id", invoiceId)
      .in("work_id", dropWorks);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (dropPieces.length) {
    const { error } = await supabase
      .from("capture_invoice_links")
      .delete()
      .eq("invoice_id", invoiceId)
      .in("piece_id", dropPieces);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Existing stock records get the invoice now (pushed works got theirs, or
  // will, through the push), for an admin only. Service role: the admin's
  // own client would do, but this keeps one code path with the push.
  let attached = 0;
  const notAttached: string[] = [];
  const admin = hasRole(gate.session.roles, "admin");
  if (pieceIds.length && !admin) {
    return NextResponse.json({ ok: true, links: workIds.length + pieceIds.length, attached, notAttached, forAdmin: pieceIds.length });
  }
  if (pieceIds.length) {
    const db = createServiceClient();
    const items = await invoiceItemCount(db, invoiceId);
    for (const pieceId of pieceIds) {
      // Either register: the picker searches both.
      const { data: ref } = await db.from("piece_ref").select("id").eq("id", pieceId).maybeSingle();
      const ok =
        Boolean(ref) &&
        (await attachInvoiceToPiece(db, invoice, pieceId, { prefill: true, setCost: items !== null && items <= 1 }));
      if (ok) attached++;
      else notAttached.push(pieceId);
    }
  }

  return NextResponse.json({ ok: true, links: workIds.length + pieceIds.length, attached, notAttached, forAdmin: 0 });
}
