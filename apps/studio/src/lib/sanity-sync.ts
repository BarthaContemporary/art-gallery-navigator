import type { SupabaseClient } from "@supabase/supabase-js";
import { safeStoragePath } from "@jvb/db/storage-path";
import { publishablePath } from "@/lib/storage-paths";
import {
  assetKeyChunks,
  isReferenceRefusal,
  sanityUploadFailureIsPermanent,
  storageFailureIsPermanent,
  SyncRetryError,
} from "@/lib/sanity-sync-rules";

export { htmlToText, SyncRetryError } from "@/lib/sanity-sync-rules";

/**
 * Helpers for the one-way inventory → website (Sanity) push. Nothing here
 * reads from Sanity back into the inventory. The decisions that need no
 * network live in lib/sanity-sync-rules.ts, where node --test covers them.
 */

export type SanityEnv = { projectId: string; dataset: string; token: string };

export function sanityEnv(): SanityEnv | null {
  const projectId = process.env.SANITY_PROJECT_ID;
  const token = process.env.SANITY_API_WRITE_TOKEN;
  if (!projectId || !token) return null;
  return { projectId, dataset: process.env.SANITY_DATASET ?? "production", token };
}

const API = "v2026-07-01";

export type SanityMutateResult =
  | { ok: true }
  /** `referenced`: a delete Sanity refused because another document still points at it. */
  | { ok: false; status: number; detail: string; referenced: boolean };

export async function sanityMutate(env: SanityEnv, mutations: unknown[]): Promise<SanityMutateResult> {
  if (mutations.length === 0) return { ok: true };
  const res = await fetch(`https://${env.projectId}.api.sanity.io/${API}/data/mutate/${env.dataset}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.token}` },
    body: JSON.stringify({ mutations }),
  });
  if (res.ok) return { ok: true };
  // Classified on the whole body: the error type can sit past the first 500 characters.
  const body = await res.text();
  return { ok: false, status: res.status, detail: body.slice(0, 500), referenced: isReferenceRefusal(res.status, body) };
}

/**
 * Upload one storage object (a display master) as a Sanity image asset,
 * once: `sanity_assets` remembers the asset id per storage path.
 *
 * Returns null when the image is to be left out for good: its path is
 * refused, the file is not in storage, or Sanity will not take it. Throws
 * SyncRetryError when another try may succeed (storage or Sanity timing out,
 * overloaded or unreachable): the caller then holds the work back for a
 * later run rather than publish it without the photograph.
 *
 * The path comes from a row and the client is the service role, which no
 * storage policy limits, and whatever it reads here goes to the public
 * website. So the path must be one file under a piece's or maker's id in
 * its own bucket (under `ownerId`, the row's own id, when given); anything
 * else is refused and the image omitted (lib/storage-paths.ts).
 */
export async function ensureImageAsset(
  supabase: SupabaseClient,
  env: SanityEnv,
  bucket: string,
  path: string,
  cache: Map<string, string>,
  ownerId?: string,
): Promise<string | null> {
  if (!publishablePath(bucket, path, ownerId)) {
    console.warn(`[sanity-sync] refused to publish an unexpected storage path in ${bucket}: ${JSON.stringify(path).slice(0, 200)}`);
    return null;
  }
  const key = `${bucket}/${path}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const bytes = await downloadForSync(supabase, bucket, path);
  if (!bytes) return null;
  const filename = path.split("/").pop() ?? "image.jpg";

  let assetId: string | undefined;
  try {
    const res = await fetch(
      `https://${env.projectId}.api.sanity.io/${API}/assets/images/${env.dataset}?filename=${encodeURIComponent(filename)}`,
      {
        method: "POST",
        headers: { "Content-Type": bytes.type || "image/jpeg", Authorization: `Bearer ${env.token}` },
        body: bytes.buffer,
      },
    );
    if (!res.ok) {
      const detail = `Sanity refused the upload of ${key} (${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}`;
      if (sanityUploadFailureIsPermanent(res.status)) {
        console.warn(`[sanity-sync] ${detail}`);
        return null;
      }
      throw new SyncRetryError(detail);
    }
    const json = (await res.json()) as { document?: { _id?: string } };
    assetId = json.document?._id;
  } catch (e) {
    if (e instanceof SyncRetryError) throw e;
    throw new SyncRetryError(`Could not upload ${key} to Sanity: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!assetId) throw new SyncRetryError(`Sanity answered the upload of ${key} without an asset id`);

  cache.set(key, assetId);
  await supabase.from("sanity_assets").upsert({ storage_path: key, asset_id: assetId }, { onConflict: "storage_path" });
  return assetId;
}

/**
 * Download a storage object for the sync. Null when the file is not there
 * (left out for good) or the path is not a plain storage path;
 * SyncRetryError when storage failed in a way another try may not (5xx,
 * timeout, network). Callers still check the path against its column's own
 * shape first (publishablePath, safeStoragePath with a rule).
 */
export async function downloadForSync(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
): Promise<{ buffer: Buffer<ArrayBuffer>; type: string } | null> {
  if (!safeStoragePath(path)) return null;
  const where = `${bucket}/${path}`;
  try {
    const { data: blob, error } = await supabase.storage.from(bucket).download(path);
    if (error) {
      if (storageFailureIsPermanent(error)) {
        console.warn(`[sanity-sync] ${where} is not in storage: ${error.message}`);
        return null;
      }
      throw new SyncRetryError(`Could not read ${where} from storage: ${error.message}`);
    }
    if (!blob) return null;
    return { buffer: Buffer.from(await blob.arrayBuffer()), type: blob.type };
  } catch (e) {
    if (e instanceof SyncRetryError) throw e;
    throw new SyncRetryError(`Could not read ${where} from storage: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Load the storage-path → asset-id cache for a set of paths. Throws when a
 * lookup fails: an empty cache would make the batch upload every image
 * again, which can outlast the function and then repeat on every retry.
 * Chunked by size (assetKeyChunks): these keys are long, and a lookup past
 * the gateway's URL limit fails.
 */
export async function loadAssetCache(supabase: SupabaseClient, keys: string[]): Promise<Map<string, string>> {
  const cache = new Map<string, string>();
  for (const chunk of assetKeyChunks(keys)) {
    const { data, error } = await supabase.from("sanity_assets").select("storage_path, asset_id").in("storage_path", chunk);
    if (error) throw new Error(`Could not read the remembered website images: ${error.message}`);
    for (const row of data ?? []) cache.set(row.storage_path as string, row.asset_id as string);
  }
  return cache;
}

export function slugify(text: string, max = 80): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, max);
}

export const artistDocId = (makerId: string) => `artist-${makerId}`;
export const workDocId = (pieceId: string) => `work-${pieceId}`;
export const listDocId = (listId: string) => `list-${listId}`;
