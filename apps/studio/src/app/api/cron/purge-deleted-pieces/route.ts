import { NextResponse } from "next/server";
import { createServiceClient } from "@jvb/db/server";
import { safeEqual } from "@/lib/secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hard-deletes inventory pieces that have been in the trash for over 30 days.
 * Schedule daily via Vercel Cron. Auth: CRON_SECRET (Authorization: Bearer …).
 *
 * The purged works' photographs and documents are not removed from storage
 * here: the database queues their files as the rows cascade away (migration
 * 0097) and /api/cron/storage-sweep removes them later. A document still
 * linked to another work is kept, detached from the purged one.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  // Header only — this route hard-deletes rows, so never accept the secret via
  // ?secret= where it would land in proxy/access logs and enable replay.
  if (!secret || !safeEqual(bearer, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("purge_deleted_pieces");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also clear blank draft records left behind by "New record".
  const { data: blanks, error: blanksErr } = await supabase.rpc("purge_blank_draft_pieces", {
    grace: "2 hours",
  });

  // And empty shipment entries (no items, no documents, no details) left behind
  // by a half-started "New import / export / temporary import / export".
  const { data: emptyShipments, error: shipmentsErr } = await supabase.rpc("purge_empty_shipments", {
    grace: "2 days",
  });

  // A failed clean-up is reported (and the run marked failed in the cron
  // log) rather than read as "nothing to clear".
  const errors = [
    blanksErr ? `blank drafts: ${blanksErr.message}` : null,
    shipmentsErr ? `empty shipments: ${shipmentsErr.message}` : null,
  ].filter((e): e is string => e !== null);

  return NextResponse.json(
    {
      ok: errors.length === 0,
      purged: data ?? 0,
      blankDrafts: blanks ?? 0,
      emptyShipments: emptyShipments ?? 0,
      ...(errors.length ? { errors } : {}),
    },
    { status: errors.length ? 500 : 200 },
  );
}
