import type { SupabaseClient } from "@supabase/supabase-js";
import { sanityMutate, type SanityEnv } from "@/lib/sanity-sync";

/**
 * Deleting the website's copies of images nothing shows any more.
 *
 * Every image the sync uploads becomes a public Sanity asset with a stable
 * CDN URL, and an asset outlives the documents that pointed at it: withdrawing
 * a work, switching off an artist, deleting, rotating or replacing a photo
 * only rewrites or deletes documents. These helpers delete the assets the
 * sync itself uploaded (tracked in `sanity_assets`, or retired from it into
 * `sanity_assets_retired`, migration 0094) once no document references them.
 * Sanity refuses to delete an asset that is still referenced, which is the
 * final guard; editors' own uploads are never in either table and are left
 * alone.
 */

/** Same API version as lib/sanity-sync.ts. */
const API = "v2026-07-01";

/**
 * An asset uploaded this recently is left for a later pass: a sync run may
 * have uploaded it and not yet written the document that references it.
 */
export const ASSET_GRACE_MS = 15 * 60_000;

type Db = SupabaseClient;
type KnownRow = { asset_id: string; last_uploaded_at: string | null };

/** Run a GROQ query. `raw` sees drafts and release versions too, so a reference from an unpublished edit counts. */
export async function sanityQuery<T>(
  env: SanityEnv,
  query: string,
  params: Record<string, unknown> = {},
  perspective: "raw" | "published" = "raw",
): Promise<T> {
  const res = await fetch(`https://${env.projectId}.api.sanity.io/${API}/data/query/${env.dataset}?perspective=${perspective}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.token}` },
    body: JSON.stringify({ query, params }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Sanity query failed: ${(await res.text()).slice(0, 300)}`);
  return ((await res.json()) as { result: T }).result;
}

export const isRecent = (at: string | null | undefined, now = Date.now()) => !!at && now - Date.parse(at) < ASSET_GRACE_MS;

/** Which of these assets exist in the dataset, with how many documents reference each. */
async function referenceCounts(env: SanityEnv, ids: string[]): Promise<Map<string, number>> {
  const rows = await sanityQuery<{ _id: string; refs: number }[]>(
    env,
    `*[_id in $ids]{ _id, "refs": count(*[references(^._id)]) }`,
    { ids },
  );
  return new Map(rows.map((r) => [r._id, r.refs]));
}

/**
 * Delete assets from Sanity: all in one transaction, or one by one when that
 * is refused (a reference appeared since they were checked, so that one stays).
 * Returns the ids actually deleted.
 */
export async function deleteSanityAssets(env: SanityEnv, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const all = await sanityMutate(env, ids.map((id) => ({ delete: { id } })));
  if (all.ok) return ids;
  const deleted: string[] = [];
  for (const id of ids) {
    const r = await sanityMutate(env, [{ delete: { id } }]);
    if (r.ok) deleted.push(id);
  }
  return deleted;
}

/** Drop every sanity_assets(_retired) row for these assets: they are gone from Sanity. */
export async function forgetSanityAssets(supabase: Db, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.rpc("forget_sanity_assets", { _asset_ids: ids });
  if (error) throw new Error(error.message);
}

/**
 * After a sync batch has written its documents: delete the assets the sync
 * uploaded for these works and artists (their storage folders, as
 * `<bucket>/<id>/` prefixes) that the new documents no longer use and that
 * nothing else references. A remembered asset that no longer exists in
 * Sanity is forgotten too, so it is uploaded again if it is ever needed.
 */
export async function deleteUnusedAssets(
  supabase: Db,
  env: SanityEnv,
  prefixes: string[],
  /** Asset ids the batch's documents reference: in use by definition. */
  keep: Set<string>,
): Promise<{ deleted: number; inUse: number }> {
  if (prefixes.length === 0) return { deleted: 0, inUse: 0 };
  const { data, error } = await supabase.rpc("sanity_assets_under", { _prefixes: prefixes });
  if (error) throw new Error(error.message);
  const now = Date.now();
  const candidates = [
    ...new Set(((data ?? []) as KnownRow[]).filter((r) => !keep.has(r.asset_id) && !isRecent(r.last_uploaded_at, now)).map((r) => r.asset_id)),
  ];
  if (candidates.length === 0) return { deleted: 0, inUse: 0 };

  const refs = await referenceCounts(env, candidates);
  const missing = candidates.filter((id) => !refs.has(id));
  const unused = candidates.filter((id) => refs.get(id) === 0);
  const deleted = await deleteSanityAssets(env, unused);
  await forgetSanityAssets(supabase, [...deleted, ...missing]);
  // Referenced from elsewhere, or a reference appeared before the delete.
  return { deleted: deleted.length, inUse: candidates.length - missing.length - deleted.length };
}

/**
 * A batch whose mutation failed may have referenced an asset that no longer
 * exists (deleted in Sanity by hand, or by a cleanup running alongside), and
 * a remembered id would fail every retry the same way. Forget any of these
 * that are missing so the next run uploads them again.
 */
export async function forgetMissingAssets(supabase: Db, env: SanityEnv, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const found = new Set(await sanityQuery<string[]>(env, `*[_id in $ids]._id`, { ids }));
  const missing = ids.filter((id) => !found.has(id));
  await forgetSanityAssets(supabase, missing);
  return missing.length;
}

/** Of these asset ids, the ones the sync uploaded (either table), with the latest upload of each. */
export async function knownSanityAssets(supabase: Db, ids: string[]): Promise<Map<string, string | null>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.rpc("sanity_assets_known", { _asset_ids: ids });
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as KnownRow[]).map((r) => [r.asset_id, r.last_uploaded_at]));
}
