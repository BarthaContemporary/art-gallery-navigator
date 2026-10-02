import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { addPiecesToList } from "@/lib/list-add";
import { writeInChunks } from "@/lib/chunk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The current user's temporary flags (piece_flags, RLS-scoped to the user).
 *
 * Body is one of:
 *   { pieceIds: string[], flagged: boolean }           — set / clear flags on these works
 *   { action: "clear" }                                — drop every flag
 *   { action: "toList", listId?, name?, clear?: bool } — file all flagged works
 *                                                        into a list, optionally
 *                                                        clearing the flags after
 */
export async function POST(req: Request) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { pieceIds?: unknown; flagged?: unknown; action?: unknown; listId?: unknown; name?: unknown; clear?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (body.action === "clear") {
    const { error } = await supabase.from("piece_flags").delete().eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "toList") {
    const { data: flags, error } = await supabase.from("piece_flags").select("piece_id").eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const pieceIds = (flags ?? []).map((f) => f.piece_id as string);
    if (pieceIds.length === 0) return NextResponse.json({ error: "Nothing is flagged" }, { status: 400 });
    const result = await addPiecesToList(supabase, user.id, {
      listId: typeof body.listId === "string" ? body.listId : undefined,
      name: typeof body.name === "string" ? body.name : undefined,
      pieceIds,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    if (body.clear === true) {
      await supabase.from("piece_flags").delete().eq("user_id", user.id);
    }
    return NextResponse.json({ ok: true, listId: result.listId, added: result.added, skipped: result.skipped });
  }

  const pieceIds = Array.isArray(body.pieceIds)
    ? [...new Set(body.pieceIds.filter((x): x is string => typeof x === "string"))].slice(0, 2000)
    : [];
  if (pieceIds.length === 0) return NextResponse.json({ error: "No items selected" }, { status: 400 });

  if (body.flagged === false) {
    const { error } = await writeInChunks(pieceIds, (chunk) =>
      supabase.from("piece_flags").delete().eq("user_id", user.id).in("piece_id", chunk),
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await writeInChunks(pieceIds, (chunk) =>
      supabase
        .from("piece_flags")
        .upsert(chunk.map((piece_id) => ({ user_id: user.id, piece_id })), {
          onConflict: "user_id,piece_id",
          ignoreDuplicates: true,
        }),
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: pieceIds.length });
}
