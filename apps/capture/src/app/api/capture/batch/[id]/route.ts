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

function str(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}
