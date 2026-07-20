import { NextResponse } from "next/server";
import { getSupabase, requireCapture } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELDS = [
  "maker",
  "title",
  "year",
  "medium",
  "dimensions_text",
  "period",
  "origin_region",
  "category",
  "notes",
] as const;

/** Create a new work inside a batch. */
export async function POST(req: Request) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { batchId, sortOrder } = (await req.json().catch(() => ({}))) as {
    batchId?: string;
    sortOrder?: number;
  };
  if (!batchId) return NextResponse.json({ error: "Missing batch" }, { status: 400 });

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("capture_works")
    .insert({ batch_id: batchId, sort_order: typeof sortOrder === "number" ? sortOrder : 0 })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ work: data });
}

/** Autosave edited fields. */
export async function PATCH(req: Request) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const f of FIELDS) {
    if (f in body) {
      const s = String(body[f] ?? "").trim();
      patch[f] = s || null;
    }
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

  const supabase = await getSupabase();
  const { error } = await supabase.from("capture_works").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Remove a work (its photos cascade). */
export async function DELETE(req: Request) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = await getSupabase();
  // Note the batch so we can clean it up if this was its last work.
  const { data: work } = await supabase.from("capture_works").select("batch_id").eq("id", id).maybeSingle();

  const { error } = await supabase.from("capture_works").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Don't leave empty draft batches lingering (they inflate the menu counter).
  if (work?.batch_id) {
    const { count } = await supabase
      .from("capture_works")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", work.batch_id);
    if ((count ?? 0) === 0) {
      await supabase.from("capture_batches").delete().eq("id", work.batch_id).eq("status", "draft");
    }
  }
  return NextResponse.json({ ok: true });
}
