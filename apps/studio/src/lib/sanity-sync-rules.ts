/**
 * The decisions the website sync (api/sync/sanity, lib/sanity-sync.ts) makes
 * that need no network: how a failure is classed, how its lookups are split,
 * what a finished batch writes back to the outbox, and the profile text.
 * Pure and self-contained (no imports) so `node --test` runs it directly.
 */

/* ---- failures ------------------------------------------------------------ */

/**
 * A storage download or Sanity upload that failed in a way another attempt
 * may not (a timeout, a 5xx, a 429, the network). The sync then leaves the
 * work or artist for a later run instead of publishing it without the image.
 */
export class SyncRetryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncRetryError";
  }
}

/**
 * True when a failed storage call says the file is not there (or the path is
 * not one storage accepts), so another try gives the same answer and the
 * image is simply left out. storage-js returns a StorageApiError with the
 * HTTP status and the service's own code (self-hosted storage answers a
 * missing object with HTTP 400 and statusCode "404"); a network failure
 * comes back as a StorageUnknownError with neither, and counts as worth
 * retrying, as do 5xx, 429 and refused credentials.
 */
export function storageFailureIsPermanent(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: unknown; statusCode?: unknown };
  const code = Number(e.statusCode);
  const effective = Number.isInteger(code) && code >= 100 && code < 600 ? code : Number(e.status);
  return effective === 400 || effective === 404 || effective === 410;
}

/**
 * True when Sanity refused an uploaded file for good (not an image, too
 * large): any 4xx except timeouts, rate limits and credentials, which a
 * later run may get past.
 */
export function sanityUploadFailureIsPermanent(status: number): boolean {
  return status >= 400 && status < 500 && ![401, 403, 408, 425, 429].includes(status);
}

/** The error `type`s in a Sanity API error body, the items of a failed transaction included. */
export function sanityErrorTypes(body: string): string[] {
  const types: string[] = [];
  try {
    const json = JSON.parse(body) as { error?: { type?: unknown; items?: { error?: { type?: unknown } }[] } };
    if (typeof json.error?.type === "string") types.push(json.error.type);
    for (const item of json.error?.items ?? []) if (typeof item?.error?.type === "string") types.push(item.error.type);
  } catch {
    for (const m of body.matchAll(/"type"\s*:\s*"([A-Za-z]+)"/g)) types.push(m[1]!);
  }
  return types;
}

/**
 * True when Sanity refused to delete a document because another document
 * (an event saved before its references were made weak) still points at it.
 * That answer stands until someone edits the event, so the row is finished
 * and the refusal recorded; any other failed delete is tried again.
 */
export function isReferenceRefusal(status: number, body: string): boolean {
  if (status < 400 || status >= 500 || status === 429) return false;
  return sanityErrorTypes(body).includes("documentHasExistingReferencesError") || /cannot be deleted as there are references/i.test(body);
}

/* ---- lookups --------------------------------------------------------------- */

/**
 * Bytes of URL the storage paths of one `.in("storage_path", …)` lookup may
 * take. PostgREST filters travel in the URL and the gateway answers 414 past
 * about 8 KB (lib/chunk.ts); a key such as
 * `piece-derivatives/<uuid>/<uuid>.sq-1600x1200.jpg` is over 100 bytes once
 * encoded, three times a bare uuid, so lib/chunk's 100 ids would not fit.
 */
export const ASSET_LOOKUP_BYTES = 4000;

/** Roughly what one key adds to the request line: `"<key>",` URL-encoded. */
const encodedLength = (key: string) => encodeURIComponent(`"${key}",`).length;

/** The keys, once each and in order, in chunks whose encoded size stays under `maxBytes`. */
export function assetKeyChunks(keys: readonly string[], maxBytes = ASSET_LOOKUP_BYTES): string[][] {
  const chunks: string[][] = [];
  let chunk: string[] = [];
  let size = 0;
  for (const key of new Set(keys.filter(Boolean))) {
    const n = encodedLength(key);
    if (chunk.length > 0 && size + n > maxBytes) {
      chunks.push(chunk);
      chunk = [];
      size = 0;
    }
    chunk.push(key);
    size += n;
  }
  if (chunk.length > 0) chunks.push(chunk);
  return chunks;
}

/* ---- settling a batch ------------------------------------------------------ */

export type EntityType = "piece" | "maker" | "list";
export type SyncEntity = { type: EntityType; id: string };
export type OutboxRow = { id: number; entity_type: string; entity_id: string };

export const entityKey = (type: string, id: string) => `${type}:${id}`;

/**
 * What one run did with a work, artist or list.
 *  pushed   its document was written or removed. `incomplete` names images
 *           left out because they would not upload (only once the entity
 *           has waited too long, see the route's HOLD_LIMIT_MS); `requeue`
 *           queues it once more (a square tile left for a fresh invocation).
 *  refused  Sanity would not delete it (still referenced): recorded, done.
 *  held     a read or upload failed: nothing written, its rows left
 *           unprocessed so the claim lapses and a later run tries again.
 *  gave_up  held for too long: recorded as an error, its rows finished, so
 *           one bad entity cannot keep coming back for ever.
 *  deferred not started before the invocation ran out of time: nothing
 *           written, queued again as a fresh row for the next invocation.
 */
export type Outcome =
  | { kind: "pushed"; incomplete?: string; requeue?: boolean }
  | { kind: "refused"; reason: string }
  | { kind: "held"; reason: string }
  | { kind: "gave_up"; reason: string }
  | { kind: "deferred" };

export type StateUpdate = SyncEntity & { status: "ok" | "error"; error: string | null; pushed: boolean };

export type Settlement = {
  /** Outbox rows to mark processed. */
  done: number[];
  /** Entities to queue again as fresh rows. */
  requeue: SyncEntity[];
  /** sanity_sync_state rows (none for an entity deferred before it started). */
  state: StateUpdate[];
  /** Entities whose assets the cleanup may delete: their documents are as this run left them. */
  sweep: SyncEntity[];
  /** Entities whose document this run wrote or removed and that are not queued again: checked for an overlapping run. */
  written: SyncEntity[];
};

/** What the outbox and the sync state learn from a batch. An entity with no outcome counts as pushed. */
export function settleBatch(rows: readonly OutboxRow[], outcomes: ReadonlyMap<string, Outcome>): Settlement {
  const entities = new Map<string, SyncEntity>();
  for (const r of rows) {
    const key = entityKey(r.entity_type, r.entity_id);
    if (!entities.has(key)) entities.set(key, { type: r.entity_type as EntityType, id: r.entity_id });
  }
  const out: Settlement = { done: [], requeue: [], state: [], sweep: [], written: [] };
  const held = new Set<string>();
  for (const [key, entity] of entities) {
    const o = outcomes.get(key) ?? { kind: "pushed" };
    switch (o.kind) {
      case "pushed":
        out.state.push({ ...entity, status: o.incomplete ? "error" : "ok", error: o.incomplete ?? null, pushed: true });
        out.sweep.push(entity);
        if (o.requeue) out.requeue.push(entity);
        else out.written.push(entity);
        break;
      case "refused":
        out.state.push({ ...entity, status: "error", error: o.reason, pushed: false });
        out.sweep.push(entity);
        break;
      case "held":
        held.add(key);
        out.state.push({ ...entity, status: "error", error: `Not pushed; will retry: ${o.reason}`, pushed: false });
        break;
      case "gave_up":
        out.state.push({ ...entity, status: "error", error: o.reason, pushed: false });
        break;
      case "deferred":
        out.requeue.push(entity);
        break;
    }
  }
  out.done = rows.filter((r) => !held.has(entityKey(r.entity_type, r.entity_id))).map((r) => r.id);
  return out;
}

/**
 * Two runs can hold rows for the same entity: claims are per row, and an
 * edit made while a run is busy wakes a second one. If the second wrote
 * first, the first run's older snapshot would win. So after writing, a run
 * looks at the entity's later rows: one already claimed or processed by
 * another run means that run may have written before this one, and the
 * entity is queued once more, so its newest state is the one pushed last.
 * A later row still waiting unclaimed needs nothing: whoever claims it reads
 * after this run's write.
 */
export function overlappedEntities(
  batch: readonly OutboxRow[],
  later: readonly (OutboxRow & { claimed_at: string | null; processed_at: string | null })[],
  written: readonly SyncEntity[],
): SyncEntity[] {
  const mine = new Map<string, number>();
  for (const r of batch) {
    const key = entityKey(r.entity_type, r.entity_id);
    mine.set(key, Math.max(mine.get(key) ?? -Infinity, r.id));
  }
  const takenElsewhere = new Set<string>();
  const waiting = new Set<string>();
  for (const r of later) {
    const key = entityKey(r.entity_type, r.entity_id);
    const highest = mine.get(key);
    if (highest === undefined || r.id <= highest) continue;
    if (r.claimed_at || r.processed_at) takenElsewhere.add(key);
    else waiting.add(key);
  }
  return written.filter((e) => {
    const key = entityKey(e.type, e.id);
    return takenElsewhere.has(key) && !waiting.has(key);
  });
}

/* ---- text ------------------------------------------------------------------ */

const BLOCK_TAG = /<\s*\/?\s*(p|div|li|h[1-6]|ul|ol|blockquote)\b[^>]*>/gi;

/**
 * Rich-text profile → plain paragraphs for the artist's long biography.
 * Whitespace in the HTML source is collapsed as a browser shows it; a line
 * break (`<br>`, or `<br />` as the sanitiser writes it) and the start or end
 * of a block (paragraph, list item, heading) start a new paragraph. Entities
 * are decoded once, `&amp;` last, so text that reads "&lt;" stays so.
 */
export function htmlToText(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/\s+/g, " ")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(BLOCK_TAG, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (m, n: string) => fromCodePoint(Number(n)) ?? m)
    .replace(/&#x([0-9a-f]+);/gi, (m, n: string) => fromCodePoint(parseInt(n, 16)) ?? m)
    .replace(/&amp;/g, "&")
    .replace(/ /g, " ")
    .split(/\n+/)
    .map((l) => l.replace(/ {2,}/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
  return text || null;
}

function fromCodePoint(n: number): string | null {
  return Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : null;
}
