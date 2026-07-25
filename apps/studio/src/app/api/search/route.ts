import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Unified quick-search behind the ⌘K palette: ranked piece hits (reusing the
// pieces_search RPC + vw_pieces_list for display) plus fuzzy contact hits. Kept
// deliberately small — the palette shows the top few of each and links through
// to the full inventory / contacts search for more.
export async function GET(req: Request) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ pieces: [], contacts: [] });

  const [pieceHits, contactHits] = await Promise.all([
    supabase.rpc("pieces_search", { q }),
    supabase.rpc("crm_contacts_search", { q }).select("id, first_name, last_name, email").limit(6),
  ]);

  // Hydrate the top piece ids (rank order preserved) for display.
  const ids = ((pieceHits.data ?? []) as Array<{ id: string }>).slice(0, 6).map((h) => h.id);
  let pieces: Array<{
    id: string;
    stock_number: string;
    title: string | null;
    maker_name: string | null;
    status: string | null;
  }> = [];
  if (ids.length > 0) {
    const { data: rows } = await supabase
      .from("vw_pieces_list")
      .select("id, stock_number, title, maker_name, status")
      .in("id", ids);
    const byId = new Map((rows ?? []).map((r) => [r.id as string, r]));
    pieces = ids
      .map((id) => byId.get(id))
      .filter(Boolean) as typeof pieces;
  }

  const contacts = (
    (contactHits.data ?? []) as Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    }>
  ).map((c) => ({
    id: c.id,
    name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Unnamed",
    email: c.email ?? null,
  }));

  return NextResponse.json({ pieces, contacts });
}
