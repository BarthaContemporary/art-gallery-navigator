import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { addPiecesToList, flagsToClear } from "@/lib/list-add";
import { writeInChunks } from "@/lib/chunk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The current user's flags after a write, so the table can show the true
 * total rather than add up deltas for works it cannot see (other pages).
 * null when the count could not be read; the write itself still stands.
 */
async function flagTotal(supabase: SupabaseClient, userId: string): Promise<number | null> {
  const { count, error } = await supabase
    .from("piece_flags")
    .select("piece_id", { count: "exact", head: true })
    .eq("user_id", userId);
  return error ? null : (count ?? 0);
}

/**
 * The current user's temporary flags (piece_flags, RLS-scoped to the user).
 *
 * Body is one of:
 *   { pieceIds: string[], flagged: boolean }           — set / clear flags on these works
 *   { action: "clear" }                                — drop every flag
 *   { action: "toList", listId?, name?, clear?: bool } — file all flagged works
 *                                                        into a list, optionally
 *                                                        clearing the flags after
 *
 * Answers with `flagCount`, the user's flags after the write (null if it
 * could not be counted).
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
    return NextResponse.json({ ok: true, flagCount: 0 });
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
    const filed = {
      listId: result.listId,
      added: result.added,
      already: result.already,
      skipped: result.skipped,
    };
    if (body.clear === true) {
      // Clear the flags of what is now in the list (and of works that no
      // longer exist), but not of the works left out: a skipped non-JvdB
      // work is in no list, and its flag is the only way back to it.
      const { error: clearErr } =
        result.leftOutIds.length === 0
          ? await supabase.from("piece_flags").delete().eq("user_id", user.id)
          : await writeInChunks(flagsToClear(pieceIds, result.leftOutIds), (chunk) =>
              supabase.from("piece_flags").delete().eq("user_id", user.id).in("piece_id", chunk),
            );
      if (clearErr) {
        return NextResponse.json(
          {
            ...filed,
            error: `The works were filed, but the flags could not be cleared: ${clearErr.message}`,
            flagCount: await flagTotal(supabase, user.id),
          },
          { status: 500 },
        );
      }
    }
    return NextResponse.json({ ok: true, ...filed, flagCount: await flagTotal(supabase, user.id) });
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
  return NextResponse.json({ ok: true, count: pieceIds.length, flagCount: await flagTotal(supabase, user.id) });
}
