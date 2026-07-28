import { NextResponse } from "next/server";
import { getSupabase, requireCapture } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Search existing inventory pieces to link an invoice to. */
export async function GET(req: Request) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const supabase = await getSupabase();
  // Strip PostgREST filter metacharacters too — commas, dots and parens would
  // otherwise let a crafted q inject extra OR terms into the .or() below.
  const like = `%${q.replace(/[%_,.()]/g, "")}%`;
  const { data, error } = await supabase
    // Both registers: a work photographed at a fair may be non-JvdB stock.
    .from("vw_pieces_list")
    .select("id, stock_number, title, maker_name")
    .or(`stock_number.ilike.${like},title.ilike.${like}`)
    .limit(15);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = (data ?? []).map((p) => ({
    id: p.id,
    stock_number: p.stock_number,
    title: p.title,
    maker: p.maker_name ?? null,
  }));
  return NextResponse.json({ results });
}
