import { NextResponse } from "next/server";
import { getSession, getSupabase } from "@/lib/supabase";
import { paletteSearch } from "@/lib/palette-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The ⌘K palette's search (components/command-palette.tsx): works, makers,
 * contacts and records, a few of each, with links through to the full
 * inventory and contacts searches. The session and its roles are read once,
 * here; lib/palette-search.ts decides by those roles what is searched (no
 * contacts and no search engine for the accountant) and runs every query
 * through the user's own client, so row level security applies.
 *
 * Answers { pieces, makers, contacts, records, similar, failed }: a group
 * that fails is empty and named in `failed`, the others still answer.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q");
  const supabase = await getSupabase();
  return NextResponse.json(await paletteSearch(supabase, q, session.roles));
}
