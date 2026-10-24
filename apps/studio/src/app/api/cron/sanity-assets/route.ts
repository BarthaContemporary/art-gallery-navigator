import { NextResponse } from "next/server";
import { createServiceClient } from "@jvb/db/server";
import { safeEqual } from "@/lib/secret";
import { sanityEnv, type SanityEnv } from "@/lib/sanity-sync";
import { chunkIds, selectInChunks } from "@/lib/chunk";
import { isUuid, isWebsiteRole, syncUploadImageId } from "@/lib/website-images";
import { deleteSanityAssets, forgetSanityAssets, isRecent, knownSanityAssets, sanityQuery } from "@/lib/sanity-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Assets deleted per run (one Sanity transaction): small batches, the rest next hour. */
const DELETE_BATCH = 100;
/** Unreferenced assets read from Sanity per page. */
const PAGE = 100;
/** Works sent back to the sync per run. */
const REQUEUE_BATCH = 100;
/** No new page is started after this long (maxDuration is 60 s). */
const TIME_BUDGET_MS = 40_000;

type Db = ReturnType<typeof createServiceClient>;

/**
 * Hourly tidy-up of the images on the public website (security review
 * 2026-10, findings F16 and F17). The sync itself deletes what a work or
 * artist stops using the moment it rewrites them; this catches the rest:
 *
 *  1. Works published before the sync stopped sending backs, condition and
 *     document shots, captions and roles still carry them (their images have
 *     a role or caption). Up to 100 a run go back on the sync queue, once,
 *     and the sync rewrites each and deletes the photographs it dropped.
 *  2. Image assets no document references, page by page in id order. One is
 *     deleted only when the sync uploaded it: tracked in sanity_assets (live
 *     or retired, migration 0094), or named the way the sync names a work's
 *     image (`<image id>.jpg`, `<image id>.sq-<w>x<h>.jpg`) after a
 *     photograph still in the inventory, which covers uploads forgotten
 *     before retired assets were kept. Anything else is an editor's and is
 *     left alone. Sanity refuses to delete an asset that is referenced.
 *
 * Safe to repeat. GET ?dry=1 changes nothing and reports what a run would do,
 * plus the web-visible works that have photographs but none the website may
 * show (they appear without a picture).
 * Auth: CRON_SECRET bearer header only, as the other crons.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!secret || !safeEqual(bearer, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const env = sanityEnv();
  if (!env) return NextResponse.json({ error: "Sanity env not configured" }, { status: 503 });

  const dry = new URL(request.url).searchParams.get("dry") === "1";
  const supabase = createServiceClient();
  const deadline = Date.now() + TIME_BUDGET_MS;
  try {
    const works = await requeueOldWorks(supabase, env, dry);
    const assets = await sweepUnusedAssets(supabase, env, dry, deadline);
    const report = dry ? { worksWithoutPicture: await worksWithoutWebsitePicture(supabase) } : {};
    return NextResponse.json({ ok: true, dry, works, assets, ...report });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/** Works whose document still has images with a role or caption: written before the sync stopped sending them. */
async function requeueOldWorks(supabase: Db, env: SanityEnv, dry: boolean) {
  const filter = `_type == "work" && count(images[defined(role) || defined(caption)]) > 0`;
  const found = await sanityQuery<{ total: number; works: { id: string | null; stockNumber: string | null }[] }>(
    env,
    `{ "total": count(*[${filter}]), "works": *[${filter}] | order(_id asc) [0...${REQUEUE_BATCH}] { "id": supabaseId, stockNumber } }`,
    {},
    "published",
  );
  const ids = [...new Set(found.works.map((w) => w.id).filter(isUuid))];
  // One waiting row per work is enough; a stuck sync must not pile them up.
  const waiting = new Set(
    (
      await selectInChunks<{ entity_id: string }>(ids, (chunk) =>
        supabase.from("sync_outbox").select("entity_id").eq("entity_type", "piece").is("processed_at", null).in("entity_id", chunk),
      )
    ).map((r) => r.entity_id),
  );
  const queue = ids.filter((id) => !waiting.has(id));
  if (dry) return { toResync: found.total, wouldQueue: queue.length, sample: found.works.slice(0, 20).map((w) => w.stockNumber) };
  if (queue.length > 0) {
    const { error } = await supabase.from("sync_outbox").insert(queue.map((id) => ({ entity_type: "piece", entity_id: id, op: "upsert" })));
    if (error) throw new Error(error.message);
  }
  return { toResync: found.total, queued: queue.length };
}

/** Unreferenced image assets the sync uploaded: deleted in a batch (or listed, when dry). */
async function sweepUnusedAssets(supabase: Db, env: SanityEnv, dry: boolean, deadline: number) {
  const chosen: { id: string; filename: string | null; why: "tracked" | "named" }[] = [];
  let scanned = 0;
  let notOurs = 0;
  let recent = 0;
  let after = "";
  const now = Date.now();
  while (chosen.length < DELETE_BATCH && Date.now() < deadline) {
    const page = await sanityQuery<{ _id: string; originalFilename: string | null; _createdAt: string | null }[]>(
      env,
      `*[_type == "sanity.imageAsset" && _id > $after && count(*[references(^._id)]) == 0] | order(_id asc) [0...${PAGE}] { _id, originalFilename, _createdAt }`,
      { after },
    );
    if (page.length === 0) break;
    after = page[page.length - 1]!._id;
    scanned += page.length;

    const known = await knownSanityAssets(supabase, page.map((a) => a._id));
    const named = [...new Set(page.filter((a) => !known.has(a._id)).map((a) => syncUploadImageId(a.originalFilename)).filter(isUuid))];
    const inInventory = new Set(
      (await selectInChunks<{ id: string }>(named, (chunk) => supabase.from("piece_images").select("id").in("id", chunk))).map((r) => r.id),
    );
    for (const a of page) {
      if (chosen.length >= DELETE_BATCH) break;
      const tracked = known.has(a._id);
      // A sync run may have just uploaded it and not yet written the document.
      if (isRecent(a._createdAt, now) || (tracked && isRecent(known.get(a._id), now))) {
        recent++;
      } else if (tracked) {
        chosen.push({ id: a._id, filename: a.originalFilename, why: "tracked" });
      } else if (inInventory.has(syncUploadImageId(a.originalFilename) ?? "")) {
        chosen.push({ id: a._id, filename: a.originalFilename, why: "named" });
      } else {
        notOurs++;
      }
    }
    if (page.length < PAGE) break;
  }

  if (dry) return { scanned, notOurs, recent, wouldDelete: chosen.length, sample: chosen };
  const deleted = await deleteSanityAssets(env, chosen.map((c) => c.id));
  await forgetSanityAssets(supabase, deleted);
  return { scanned, notOurs, recent, deleted: deleted.length, stillInUse: chosen.length - deleted.length };
}

/** Stock numbers of web-visible works with finished photographs but none in a website role (owner decision 12). */
async function worksWithoutWebsitePicture(supabase: Db): Promise<string[]> {
  const works: { id: string; stock_number: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("vw_pieces_list")
      .select("id, stock_number")
      .eq("web_visible", true)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    works.push(...((data ?? []) as { id: string; stock_number: string }[]));
    if (!data || data.length < 1000) break;
  }
  const withPhotos = new Set<string>();
  const withWebsitePhoto = new Set<string>();
  // Small chunks: one row per photograph, and a response holds at most 1000 rows.
  for (const chunk of chunkIds(works.map((w) => w.id), 20)) {
    const { data, error } = await supabase
      .from("piece_images")
      .select("piece_id, role")
      .in("piece_id", chunk)
      .not("storage_path_display", "is", null)
      .eq("processing_status", "done");
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as { piece_id: string; role: string }[]) {
      withPhotos.add(row.piece_id);
      if (isWebsiteRole(row.role)) withWebsitePhoto.add(row.piece_id);
    }
  }
  return works
    .filter((w) => withPhotos.has(w.id) && !withWebsitePhoto.has(w.id))
    .map((w) => w.stock_number)
    .sort();
}
