import { NextResponse } from "next/server";
import { getSupabase, requireCapture } from "@/lib/supabase";
import { containsPattern } from "@/lib/capture-values";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Hit = { id: string; stock_number: string; title: string | null; maker_name: string | null };

/** Search existing inventory pieces to link an invoice to. */
export async function GET(req: Request) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ results: [] });

  const supabase = await getSupabase();
  // Two plain filters rather than one .or(): a plain filter's value is taken
  // whole, so "Mt. Fuji", "No. 12" or "Box (lacquer)" are searched as typed
  // and nothing in q can add filter terms. Wildcards in q match themselves.
  const like = containsPattern(q);
  // Both registers: a work photographed at a fair may be non-JvdB stock.
  const search = (column: "stock_number" | "title") =>
    supabase.from("vw_pieces_list").select("id, stock_number, title, maker_name").ilike(column, like).limit(15);
  const [byNumber, byTitle] = await Promise.all([search("stock_number"), search("title")]);
  const error = byNumber.error ?? byTitle.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seen = new Set<string>();
  const results = [...((byNumber.data ?? []) as Hit[]), ...((byTitle.data ?? []) as Hit[])]
    .filter((p) => !seen.has(p.id) && Boolean(seen.add(p.id)))
    .slice(0, 15)
    .map((p) => ({
      id: p.id,
      stock_number: p.stock_number,
      title: p.title,
      maker: p.maker_name ?? null,
    }));
  return NextResponse.json({ results });
}
