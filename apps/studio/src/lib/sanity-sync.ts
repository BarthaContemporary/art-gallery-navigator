import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Helpers for the one-way inventory → website (Sanity) push. Nothing here
 * reads from Sanity back into the inventory.
 */

export type SanityEnv = { projectId: string; dataset: string; token: string };

export function sanityEnv(): SanityEnv | null {
  const projectId = process.env.SANITY_PROJECT_ID;
  const token = process.env.SANITY_API_WRITE_TOKEN;
  if (!projectId || !token) return null;
  return { projectId, dataset: process.env.SANITY_DATASET ?? "production", token };
}

const API = "v2026-07-01";

export async function sanityMutate(env: SanityEnv, mutations: unknown[]): Promise<{ ok: true } | { ok: false; detail: string }> {
  if (mutations.length === 0) return { ok: true };
  const res = await fetch(`https://${env.projectId}.api.sanity.io/${API}/data/mutate/${env.dataset}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.token}` },
    body: JSON.stringify({ mutations }),
  });
  if (res.ok) return { ok: true };
  return { ok: false, detail: (await res.text()).slice(0, 500) };
}

/**
 * Upload one storage object (a display master) as a Sanity image asset,
 * once: `sanity_assets` remembers the asset id per storage path. Returns
 * null when the file can't be read — the caller just omits that image.
 */
export async function ensureImageAsset(
  supabase: SupabaseClient,
  env: SanityEnv,
  bucket: string,
  path: string,
  cache: Map<string, string>,
): Promise<string | null> {
  const key = `${bucket}/${path}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const { data: blob, error } = await supabase.storage.from(bucket).download(path);
  if (error || !blob) return null;
  const bytes = Buffer.from(await blob.arrayBuffer());
  const filename = path.split("/").pop() ?? "image.jpg";

  const res = await fetch(
    `https://${env.projectId}.api.sanity.io/${API}/assets/images/${env.dataset}?filename=${encodeURIComponent(filename)}`,
    {
      method: "POST",
      headers: { "Content-Type": blob.type || "image/jpeg", Authorization: `Bearer ${env.token}` },
      body: bytes,
    },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { document?: { _id?: string } };
  const assetId = json.document?._id;
  if (!assetId) return null;

  cache.set(key, assetId);
  await supabase.from("sanity_assets").upsert({ storage_path: key, asset_id: assetId }, { onConflict: "storage_path" });
  return assetId;
}

/** Load the storage-path → asset-id cache for a set of paths. */
export async function loadAssetCache(supabase: SupabaseClient, keys: string[]): Promise<Map<string, string>> {
  const cache = new Map<string, string>();
  if (keys.length === 0) return cache;
  for (let i = 0; i < keys.length; i += 200) {
    const { data } = await supabase
      .from("sanity_assets")
      .select("storage_path, asset_id")
      .in("storage_path", keys.slice(i, i + 200));
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

/** Rich-text profile → plain paragraphs for the artist's long biography. */
export function htmlToText(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n\n");
  return text || null;
}

export const artistDocId = (makerId: string) => `artist-${makerId}`;
export const workDocId = (pieceId: string) => `work-${pieceId}`;
