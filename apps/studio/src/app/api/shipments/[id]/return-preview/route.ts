import { NextResponse } from "next/server";
import { getSession, getSupabase } from "@/lib/supabase";
import { loadPieceSummaries } from "@/lib/piece-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PieceLite = { stock_number: string | null; title: string | null };

/**
 * Preview a temporary-export return: which still-out items would be marked
 * returned, and which would be skipped (written off / permanently exported),
 * so the return can be confirmed with eyes open.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const supabase = await getSupabase();

  const { data: open } = await supabase
    .from("piece_shipments")
    .select("piece_id")
    .eq("shipment_id", id)
    .eq("kind", "temporary_export")
    .is("returned_at", null)
    .is("closed_reason", null);
  const summaries = await loadPieceSummaries(
    supabase,
    (open ?? []).map((r) => r.piece_id as string),
  );
  const rows = ((open ?? []) as { piece_id: string }[]).map((r) => ({
    piece_id: r.piece_id,
    piece: summaries.get(r.piece_id) ?? null,
  }));

  const ids = rows.map((r) => r.piece_id);
  let exportedIds = new Set<string>();
  if (ids.length) {
    const { data: exp } = await supabase
      .from("piece_shipments")
      .select("piece_id")
      .eq("kind", "export")
      .in("piece_id", ids);
    exportedIds = new Set((exp ?? []).map((r) => r.piece_id as string));
  }

  const willReturn: PieceLite[] = [];
  const writtenOff: PieceLite[] = [];
  const exported: PieceLite[] = [];
  for (const r of rows) {
    const lite = { stock_number: r.piece?.stock_number ?? null, title: r.piece?.title ?? null };
    if (r.piece?.status === "written_off") writtenOff.push(lite);
    else if (exportedIds.has(r.piece_id)) exported.push(lite);
    else willReturn.push(lite);
  }

  return NextResponse.json({ willReturn, writtenOff, exported });
}
