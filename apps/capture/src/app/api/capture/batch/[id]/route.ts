import { NextResponse } from "next/server";
import { getSupabase, requireCapture } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE_TYPES = ["gallery", "dealer", "auction", "fair", "private", "other"];

/** Edit the batch's source (name / type / address) and notes. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if ("source_name" in body) patch.source_name = str(body.source_name);
  if ("source_address" in body) patch.source_address = str(body.source_address);
  if ("notes" in body) patch.notes = str(body.notes);
  // Which register the whole purchase belongs to, decided at capture time.
  if ("ledger" in body) {
    patch.ledger = String(body.ledger) === "external" ? "external" : "jvb";
  }
  if ("source_type" in body) {
    const v = String(body.source_type ?? "");
    patch.source_type = SOURCE_TYPES.includes(v) ? v : null;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

  const supabase = await getSupabase();
  const { error } = await supabase.from("capture_batches").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Delete an entire captured purchase: the batch, its works, photos + files. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { id } = await params;

  const supabase = await getSupabase();

  // Remove the stored photo files first (rows cascade from the batch delete).
  const { data: photos } = await supabase
    .from("capture_photos")
    .select("storage_path")
    .eq("batch_id", id);
  const paths = (photos ?? []).map((p) => p.storage_path).filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from("captures").remove(paths);

  // Deleting the batch cascades to capture_works and capture_photos rows.
  // (Any invoices captured for this batch are kept; their batch link is cleared.)
  const { error } = await supabase.from("capture_batches").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

function str(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}
