import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Add pieces to an existing list, or create a new (static) list and add them.
 * Body: { listId?: string, name?: string, pieceIds: string[] }.
 */
export async function POST(req: Request) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { listId?: string; name?: string; pieceIds?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const pieceIds = Array.isArray(body.pieceIds)
    ? [...new Set(body.pieceIds.filter((x): x is string => typeof x === "string"))].slice(0, 2000)
    : [];
  if (pieceIds.length === 0) {
    return NextResponse.json({ error: "No items selected" }, { status: 400 });
  }

  let listId = String(body.listId ?? "").trim();
  const name = String(body.name ?? "").trim().slice(0, 200);

  if (!listId) {
    if (!name) {
      return NextResponse.json({ error: "Choose a list or enter a name" }, { status: 400 });
    }
    const { data: created, error } = await supabase
      .from("piece_lists")
      .insert({ name, is_dynamic: false, created_by: user.id })
      .select("id")
      .single();
    if (error || !created) {
      return NextResponse.json({ error: error?.message ?? "Could not create list" }, { status: 500 });
    }
    listId = created.id;
  }

  const { data: mx } = await supabase
    .from("piece_list_items")
    .select("sort_order")
    .eq("list_id", listId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  let sort = ((mx?.sort_order as number | undefined) ?? -1) + 1;

  const rows = pieceIds.map((pid) => ({ list_id: listId, piece_id: pid, sort_order: sort++ }));
  const { error: insErr } = await supabase
    .from("piece_list_items")
    .upsert(rows, { onConflict: "list_id,piece_id", ignoreDuplicates: true });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, listId, added: rows.length });
}
