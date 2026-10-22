/*
 * PostgREST filters travel in the URL. A `.in("id", ids)` becomes
 * `id=in.(uuid,uuid,…)`, so the request line grows by ~37 bytes per id and the
 * gateway rejects it with 414 URI Too Long somewhere past 8 KB — measured
 * against the live stack, that is between 150 and 250 uuids.
 *
 * The failure is quiet in the worst way: supabase-js returns `{ data: null,
 * error }`, and any caller that destructures only `data` renders an empty
 * result while a separately-counted total still says otherwise. That is what
 * made a 425-member list report 425 and show nothing.
 *
 * So: never pass an unbounded id array to `.in()`. Split it here.
 */

/** Ids per request. 100 × 37 B ≈ 3.7 KB, comfortably inside the limit. */
export const ID_CHUNK = 100;

export function chunkIds<T>(ids: readonly T[], size = ID_CHUNK): T[][] {
  if (ids.length <= size) return ids.length ? [[...ids]] : [];
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/** Chunks in flight at once: enough to overlap round trips, not a burst. */
const CHUNK_CONCURRENCY = 4;

/**
 * Run `query` once per chunk and concatenate the rows, in chunk order.
 *
 * Up to CHUNK_CONCURRENCY chunks run at a time. Strictly one after another
 * made a 425-work list pay five round trips per pass; a burst of every chunk
 * at once would be a worse trade against a single-VPS PostgREST, so this
 * sits between the two.
 *
 * Errors are thrown, not swallowed — the whole point of this module.
 */
export async function selectInChunks<Row>(
  ids: readonly string[],
  query: (chunk: string[]) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
): Promise<Row[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  const chunks = chunkIds(unique);
  const results: Row[][] = new Array(chunks.length);
  let next = 0;
  const worker = async () => {
    while (next < chunks.length) {
      const i = next++;
      const { data, error } = await query(chunks[i] as string[]);
      if (error) throw new Error(error.message);
      results[i] = data ?? [];
    }
  };
  await Promise.all(Array.from({ length: Math.min(CHUNK_CONCURRENCY, chunks.length) }, worker));
  return results.flat();
}

/**
 * Same splitting for writes (update / delete). Returns the first error rather
 * than throwing, so server actions can redirect with a message the way the
 * rest of the app does.
 */
export async function writeInChunks(
  ids: readonly string[],
  write: (chunk: string[]) => PromiseLike<{ error: { message: string } | null }>,
): Promise<{ error: { message: string } | null }> {
  const unique = [...new Set(ids.filter(Boolean))];
  for (const chunk of chunkIds(unique)) {
    const { error } = await write(chunk);
    if (error) return { error };
  }
  return { error: null };
}
