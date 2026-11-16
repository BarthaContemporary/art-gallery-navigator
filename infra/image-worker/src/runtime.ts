/**
 * Small, pure pieces of the image worker (no imports, so `node --test` runs
 * them directly): reading its numeric settings, telling a passing failure
 * from a lasting one, and sizing, ordering and working through a batch a
 * few images at a time.
 */

/**
 * A whole number above zero from the environment, or the default. Compose
 * passes an unset variable as an empty string, and Number("") is 0: a batch
 * size of 0 claimed nothing and a poll interval of 0 spun on the database.
 */
export function positiveInt(raw: string | undefined, fallback: number): { value: number; invalid: boolean } {
  const s = (raw ?? "").trim();
  if (s === "") return { value: fallback, invalid: false };
  const n = Number(s);
  if (Number.isInteger(n) && n > 0) return { value: n, invalid: false };
  return { value: fallback, invalid: true };
}

/** A failure worth trying again later: storage or network, not the image. */
export class TransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransientError";
  }
}

// Postgres classes 08 (connection), 53 (resources), 57P (shutdown, e.g. a
// database restart), and Node's network errors.
const TRANSIENT_CODES = /^(08|53|57P)/;
const NETWORK_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH"]);

export function isTransient(err: unknown): boolean {
  if (err instanceof TransientError) return true;
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" && (TRANSIENT_CODES.test(code) || NETWORK_CODES.has(code));
}

/** A storage answer that the file is not there: retrying will not help. */
export function isNotFound(message: string): boolean {
  return /not.?found|does not exist|\b404\b/i.test(message);
}

/**
 * Postgres: the function (42883) or column (42703) does not exist yet, or
 * this role may not use it (42501): 0099's lease cannot be used.
 */
export function isMissingObject(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === "42883" || code === "42703" || code === "42501";
}

/** The lease on a claimed image (migration 0099), and the tries it gets. */
export const LEASE_SECONDS = 15 * 60;
export const MAX_ATTEMPTS = 3;

/** How long to wait before the next try after a passing failure on try n. */
export function retryDelaySeconds(attempt: number): number {
  return attempt <= 1 ? 120 : 600;
}

/**
 * How many rows one claim takes: no more than are worked on at once. A
 * claimed row waits at 'processing' until it is started, so a worker that
 * died with more claimed than in hand left the rest stranded (before 0099)
 * or waiting out their lease; unclaimed, they stay 'pending' and the next
 * cycle takes them at once.
 */
export function claimLimit(batchSize: number, concurrency: number): number {
  return Math.max(1, Math.min(batchSize, concurrency));
}

/**
 * The order and width in which to work through a claimed batch. A row
 * started before that did not finish (lease mode: processing_attempts above
 * 0, because the worker died on it or a passing failure is being retried)
 * may be the photograph that kills the worker. It runs after the fresh rows
 * and with nothing else in hand, so if it kills the worker again no other
 * image loses a try with it. Without 0099 (no counts) nothing changes.
 */
export function planBatch<T extends { processing_attempts?: number }>(
  rows: readonly T[],
  concurrency: number,
): { rows: T[]; concurrency: number } {
  const tried = (row: T) => row.processing_attempts ?? 0;
  const ordered = [...rows].sort((a, b) => tried(a) - tried(b)); // stable: claim order kept
  return { rows: ordered, concurrency: ordered.some((row) => tried(row) > 0) ? 1 : concurrency };
}

/**
 * Run fn over items, at most `limit` at a time. Once stop() is true no new
 * item starts; the ones not started are returned (to hand back unprocessed).
 */
export async function runLimited<T>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<void>,
  stop: () => boolean,
): Promise<T[]> {
  const skipped: T[] = [];
  let next = 0;
  const lane = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      const item = items[i] as T;
      if (stop()) {
        skipped.push(item);
        continue;
      }
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, lane));
  return skipped;
}
