import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { resolvePieces, byTable } from "@/lib/piece-store";
import { writeInChunks } from "@/lib/chunk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set([
  "in_stock",
  "reserved",
  "consigned_in",
  "consigned_out",
  "sold",
  "gifted",
  "returned",
  "written_off",
]);

/**
 * Bulk-edit or bulk-delete the selected pieces. The regular piece triggers
 * still fire per row (activity_log diff + location-history append), so a bulk
 * change is audited exactly like a single edit.
 *
 * Delete is the same soft delete as a single record: `deleted_at` is stamped
 * and the work drops into the 30-day recycle bin at /inventory/trash, where it
 * can be restored. Nothing here removes a row outright — the scheduled purge
 * does that, 30 days later.
 *
 * Body: { pieceIds: string[], action?: "delete", status?: string, locationId?: string }.
 */
export async function POST(req: Request) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { pieceIds?: unknown; status?: unknown; locationId?: unknown; action?: unknown };
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

  // Soft delete takes the same path as an edit — one column, every register.
  if (body.action === "delete") {
    const groups = byTable((await resolvePieces(supabase, pieceIds)).values());
    let deleted = 0;
    for (const [table, ids] of Object.entries(groups) as [keyof typeof groups, string[]][]) {
      if (ids.length === 0) continue;
      const { error } = await writeInChunks(ids, (chunk) =>
        supabase
          .from(table)
          .update({ deleted_at: new Date().toISOString() })
          .in("id", chunk)
          .is("deleted_at", null),
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      deleted += ids.length;
    }
    return NextResponse.json({ ok: true, deleted });
  }

  const patch: { status?: string; location_id?: string } = {};
  const status = typeof body.status === "string" ? body.status : "";
  if (status) {
    if (!STATUSES.has(status)) {
      return NextResponse.json({ error: "Unknown status" }, { status: 400 });
    }
    patch.status = status;
  }
  const locationId = typeof body.locationId === "string" ? body.locationId.trim() : "";
  if (locationId) patch.location_id = locationId;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  }

  // A selection can span both registers; each row has to be written through
  // the table that holds it.
  const groups = byTable((await resolvePieces(supabase, pieceIds)).values());
  let updated = 0;
  for (const [table, ids] of Object.entries(groups) as [keyof typeof groups, string[]][]) {
    if (ids.length === 0) continue;
    const { error } = await writeInChunks(ids, (chunk) =>
      supabase.from(table).update(patch).in("id", chunk),
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    updated += ids.length;
  }

  return NextResponse.json({ ok: true, updated });
}
