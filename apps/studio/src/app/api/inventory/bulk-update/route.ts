import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

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
 * Bulk-edit the status and/or location of the selected pieces. The regular
 * piece triggers still fire per row (activity_log diff + location-history
 * append), so a bulk move is fully audited like a single edit.
 * Body: { pieceIds: string[], status?: string, locationId?: string }.
 */
export async function POST(req: Request) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { pieceIds?: unknown; status?: unknown; locationId?: unknown };
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

  const { error } = await supabase.from("pieces").update(patch).in("id", pieceIds);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, updated: pieceIds.length });
}
