import { NextResponse } from "next/server";
import { getSession, getSupabase } from "@/lib/supabase";
import { loadPieceSummaries } from "@/lib/piece-store";
import { selectInChunks } from "@/lib/chunk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PieceLite = { stock_number: string | null; title: string | null };

/**
 * Preview a temporary-export return: which still-out items would be marked
 * returned, and which would be skipped (written off / permanently exported),
 * so the return can be confirmed with eyes open. The same lookups as the
 * page's recordReturn action, chunked the same way, so the two agree; a
 * failed lookup answers 500 (the form says it could not load the preview)
 * rather than a preview that would return every work.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const supabase = await getSupabase();

  const { data: open, error: openError } = await supabase
    .from("piece_shipments")
    .select("piece_id")
    .eq("shipment_id", id)
    .eq("kind", "temporary_export")
    .is("returned_at", null)
    .is("closed_reason", null);
  if (openError) return NextResponse.json({ error: openError.message }, { status: 500 });
  const ids = ((open ?? []) as { piece_id: string }[]).map((r) => r.piece_id);

  let summaries: Awaited<ReturnType<typeof loadPieceSummaries>>;
  let exportedIds = new Set<string>();
  try {
    summaries = await loadPieceSummaries(supabase, ids);
    if (ids.length) {
      const exp = await selectInChunks<{ piece_id: string }>(ids, (chunk) =>
        supabase.from("piece_shipments").select("piece_id").eq("kind", "export").in("piece_id", chunk),
      );
      exportedIds = new Set(exp.map((r) => r.piece_id));
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not check the works" },
      { status: 500 },
    );
  }

  const willReturn: PieceLite[] = [];
  const writtenOff: PieceLite[] = [];
  const exported: PieceLite[] = [];
  for (const pid of ids) {
    const piece = summaries.get(pid) ?? null;
    const lite = { stock_number: piece?.stock_number ?? null, title: piece?.title ?? null };
    if (piece?.status === "written_off") writtenOff.push(lite);
    else if (exportedIds.has(pid)) exported.push(lite);
    else willReturn.push(lite);
  }

  return NextResponse.json({ willReturn, writtenOff, exported });
}
