/*
 * PostgREST filters travel in the URL: `.in("id", ids)` becomes
 * `id=in.(uuid,uuid,…)`, about 39 bytes per uuid, and the gateway refuses a
 * request line past 8 KB (roughly 205 uuids). supabase-js then returns
 * `{ data: null, error }`, so a caller that reads only `data` shows nothing.
 *
 * The website's copy of the studio's helper (apps/studio/src/lib/chunk.ts),
 * which the website cannot import. Pure and import-free so `node --test`
 * runs it directly.
 */

/** Ids per request: 100 × ~39 B ≈ 4 KB, well inside the limit. */
export const ID_CHUNK = 100;

export function chunkIds<T>(ids: readonly T[], size = ID_CHUNK): T[][] {
  if (ids.length <= size) return ids.length ? [[...ids]] : [];
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/** Chunks in flight at once: enough to overlap round trips, not a burst. */
const CHUNK_CONCURRENCY = 4;

/** A failed read, carrying PostgREST's code (never the request, which may hold a token). */
export class ChunkReadError extends Error {
  readonly code: string | null;
  constructor(message: string, code: string | null) {
    super(message);
    this.name = "ChunkReadError";
    this.code = code;
  }
}

/**
 * Run `query` once per chunk of the (de-duplicated) ids and concatenate the
 * rows in chunk order. Throws on the first error instead of returning an
 * empty list.
 */
export async function selectInChunks<Row>(
  ids: readonly string[],
  query: (
    chunk: string[],
  ) => PromiseLike<{ data: Row[] | null; error: { message: string; code?: string | null } | null }>,
): Promise<Row[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  const chunks = chunkIds(unique);
  const results: Row[][] = new Array(chunks.length);
  let next = 0;
  const worker = async () => {
    while (next < chunks.length) {
      const i = next++;
      const { data, error } = await query(chunks[i] as string[]);
      if (error) throw new ChunkReadError(error.message, error.code ?? null);
      results[i] = data ?? [];
    }
  };
  await Promise.all(Array.from({ length: Math.min(CHUNK_CONCURRENCY, chunks.length) }, worker));
  return results.flat();
}
