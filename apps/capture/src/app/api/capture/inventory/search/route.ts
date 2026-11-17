import { NextResponse } from "next/server";
import { getSupabase, requireCapture } from "@/lib/supabase";
import { searchInventory } from "@/lib/inventory-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Search existing inventory pieces to link an invoice to: the studio's
 * ranked pieces_search (both registers: a work photographed at a fair may be
 * non-JvdB stock), rows from vw_pieces_list, at most 15. Postgres only.
 */
export async function GET(req: Request) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ results: [] });

  const supabase = await getSupabase();
  const { results, error } = await searchInventory(supabase, q);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ results });
}
