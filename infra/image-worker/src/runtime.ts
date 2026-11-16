/**
 * Small, pure pieces of the image worker (no imports, so `node --test` runs
 * them directly): reading its numeric settings, telling a passing failure
 * from a lasting one, and working through a batch a few images at a time.
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
