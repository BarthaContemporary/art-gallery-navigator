import { NextResponse } from "next/server";
import { getSupabase, getSession, canEditRecords } from "@/lib/supabase";
import { resolvePieces, byTable } from "@/lib/piece-store";
import { chunkIds } from "@/lib/chunk";

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
 * Write the selection in id chunks (a long `.in()` list is refused as too
 * long a URL), counting the rows each write actually changed: row security
 * filters a refused write to no rows and no error, so counting ids would
 * report changes that did not happen.
 */
async function writeCounted(
  ids: string[],
  write: (chunk: string[]) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<{ count: number; error: { message: string } | null }> {
  let count = 0;
  for (const chunk of chunkIds([...new Set(ids.filter(Boolean))])) {
    const { data, error } = await write(chunk);
    if (error) return { count, error };
    count += data?.length ?? 0;
  }
  return { count, error: null };
}

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
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // The accountant reads the inventory but changes nothing.
  if (!canEditRecords(session.roles)) {
    return NextResponse.json({ error: "Your role can read these records but not change them." }, { status: 403 });
  }
  const supabase = await getSupabase();

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
  // A work already in the trash is left as it is (and not counted).
  if (body.action === "delete") {
    const groups = byTable((await resolvePieces(supabase, pieceIds)).values());
    let deleted = 0;
    for (const [table, ids] of Object.entries(groups) as [keyof typeof groups, string[]][]) {
      if (ids.length === 0) continue;
      const { count, error } = await writeCounted(ids, (chunk) =>
        supabase
          .from(table)
          .update({ deleted_at: new Date().toISOString() })
          .in("id", chunk)
          .is("deleted_at", null)
          .select("id"),
      );
      deleted += count;
      if (error) return NextResponse.json({ error: error.message, deleted }, { status: 500 });
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
    const { count, error } = await writeCounted(ids, (chunk) =>
      supabase.from(table).update(patch).in("id", chunk).select("id"),
    );
    updated += count;
    if (error) return NextResponse.json({ error: error.message, updated }, { status: 500 });
  }
  if (updated === 0) {
    return NextResponse.json(
      { error: "None of the selected works could be changed: they may have been deleted. Reload the page." },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true, updated });
}
