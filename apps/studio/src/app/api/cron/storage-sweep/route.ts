import { NextResponse } from "next/server";
import { createServiceClient } from "@jvb/db/server";
import { safeEqual } from "@/lib/secret";
import { isMissingFunction } from "@/lib/db-errors";
import { planStorageRemovals } from "@/lib/storage-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * How long a deleted row's files stay in storage. Longer than the 30 daily
 * database dumps are kept (infra/scripts/backup.sh), so restoring any of them
 * never points at a file that is gone; the weekly storage replica is a plain
 * sync and passes a removal on within a week. The database never lets it
 * fall under 35 days.
 */
const KEEP_FOR = "90 days";
/** Keys handled per run; anything more waits for the next day. */
const BATCH = 500;
/** Keys per Storage API call. */
const CHUNK = 100;

/**
 * Daily removal of files whose rows are gone (review finding database-9):
 * a photograph deleted from a work (its original, display master and square
 * tiles), a document or shipment paper deleted, a maker deleted or its
 * portrait replaced, a work purged from the Trash, an upload begun and never
 * recorded. The database queues each key as its row goes (storage_removals,
 * migration 0097) and hands over only keys that have waited KEEP_FOR and that
 * no row points at again. Each key is checked against its bucket's own path
 * rule before the service role removes it through the Storage API; a key
 * that fails the check is dropped from the queue and its object left alone.
 * Each run first queues the files no row points at that the triggers never
 * saw (orphaned before 0097, or left by a race), which then wait KEEP_FOR
 * from the day they are found like any other key.
 *
 * Until migration 0097 is applied there is no queue: the run does nothing,
 * as before. GET ?dry=1 removes and queues nothing and reports what a run
 * would do. Auth: CRON_SECRET bearer header only, as the other crons.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!secret || !safeEqual(bearer, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dry = new URL(request.url).searchParams.get("dry") === "1";
  const supabase = createServiceClient();
  const skipped = { ok: true, skipped: "storage sweep functions missing (migration 0097 not applied)" };

  const { data: orphans, error: orphanErr } = await supabase.rpc("queue_storage_orphans", { _dry: dry });
  if (isMissingFunction(orphanErr)) return NextResponse.json(skipped);
  // A failed scan only delays finding orphans; the queue is still worked.
  const scanFailure = orphanErr ? `orphan scan: ${orphanErr.message}` : null;
  const found = typeof orphans === "number" ? orphans : 0;

  const { data, error } = await supabase.rpc("storage_removals_due", { _after: KEEP_FOR, _limit: BATCH, _dry: dry });
  if (isMissingFunction(error)) return NextResponse.json(skipped);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = ((data ?? []) as { bucket: string; path: string }[]).filter(
    (r) => typeof r?.bucket === "string" && typeof r?.path === "string",
  );
  const { remove, refused } = planStorageRemovals(rows);
  const count = (m: Map<string, string[]>) => [...m.values()].reduce((n, l) => n + l.length, 0);

  if (dry) {
    return NextResponse.json({
      ok: !scanFailure,
      dry,
      wouldQueue: found,
      due: rows.length,
      wouldRemove: Object.fromEntries([...remove].map(([b, l]) => [b, l.length])),
      refused: count(refused),
      sample: rows.slice(0, 20).map((r) => `${r.bucket}/${r.path}`),
      ...(scanFailure ? { failures: [scanFailure] } : {}),
    });
  }

  const failures: string[] = scanFailure ? [scanFailure] : [];
  let removed = 0;
  for (const [bucket, paths] of remove) {
    for (let i = 0; i < paths.length; i += CHUNK) {
      const chunk = paths.slice(i, i + CHUNK);
      const { error: rmErr } = await supabase.storage.from(bucket).remove(chunk);
      if (rmErr) {
        // Kept in the queue: the next run tries again.
        failures.push(`${bucket}: ${rmErr.message}`);
        continue;
      }
      const { error: fgErr } = await supabase.rpc("storage_removals_forget", { _bucket: bucket, _paths: chunk });
      if (fgErr) failures.push(`${bucket} (queue): ${fgErr.message}`);
      removed += chunk.length;
    }
  }
  // Refused keys: never handed to the Storage API, dropped from the queue so
  // they do not hold up the rest.
  for (const [bucket, paths] of refused) {
    const { error: fgErr } = await supabase.rpc("storage_removals_forget", { _bucket: bucket, _paths: paths });
    if (fgErr) failures.push(`${bucket} (queue): ${fgErr.message}`);
  }

  return NextResponse.json(
    { ok: failures.length === 0, queued: found, removed, refused: count(refused), ...(failures.length ? { failures } : {}) },
    { status: failures.length ? 500 : 200 },
  );
}
