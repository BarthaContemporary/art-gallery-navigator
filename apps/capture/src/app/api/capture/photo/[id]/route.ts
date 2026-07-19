import { NextResponse } from "next/server";
import { getSupabase, requireCapture } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Delete a captured photo (row + storage object). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { id } = await params;

  const supabase = await getSupabase();
  const { data: row } = await supabase
    .from("capture_photos")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("capture_photos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (row?.storage_path) await supabase.storage.from("captures").remove([row.storage_path]);

  return NextResponse.json({ ok: true });
}
