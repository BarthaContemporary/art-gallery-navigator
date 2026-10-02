import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { addPiecesToList } from "@/lib/list-add";

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
    ? body.pieceIds.filter((x): x is string => typeof x === "string")
    : [];
  const result = await addPiecesToList(supabase, user.id, { listId: body.listId, name: body.name, pieceIds });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, listId: result.listId, added: result.added, skipped: result.skipped });
}
