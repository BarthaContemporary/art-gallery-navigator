/*
 * The thin OpenSearch client: fetch and nothing else. No runtime dependency
 * and only `import type`, so `node --test` loads it as it is.
 *
 * Node runtime only (Buffer for basic auth): never import it from middleware
 * or a client component. The credentials never reach the browser.
 *
 * Reads answer `null` instead of throwing when OpenSearch is not configured,
 * unreachable, too slow, refuses the request, or has no such index: the
 * caller then simply uses what Postgres returned. Writes report every item.
 *
 * Nothing here logs a request body, a search term, an engine `reason` or
 * `caused_by`: OpenSearch's error text quotes field values (a refused
 * document's name and email, for instance). Errors are reduced to
 * `{ status, type }` before anyone can see them.
 *
 * Every path is one Caddy lets through (docs/ops/opensearch-runbook.md):
 * search bodies carry size and _source themselves because the search route
 * admits no query string, and bulk action lines carry no `_index` because
 * the engine refuses an explicit index in a body.
 */
import type { SearchAccount, SearchConfig, SearchKind } from "./config";

/** OpenSearch's window: `from + size` past it fails the whole search. */
export const MAX_HITS = 10_000;

/** What is kept of a failed request: never its reason or body. status 0 = no answer (network, timeout). */
export type OsError = { status: number; type: string };
export type OsResponse = { status: number; json: unknown; error: OsError | null };
export type Account = "search" | "index";

type FetchOptions = { timeoutMs?: number; ndjson?: boolean };

function authorization(a: SearchAccount): string | null {
  if (!a.user || !a.password) return null;
  return `Basic ${Buffer.from(`${a.user}:${a.password}`, "utf8").toString("base64")}`;
}

function errorType(json: unknown, status: number): string {
  const e = (json as { error?: unknown } | null)?.error;
  const t = typeof e === "object" && e !== null ? (e as { type?: unknown }).type : undefined;
  return typeof t === "string" && /^[a-z_]{1,80}$/.test(t) ? t : `http_${status}`;
}

/**
 * One request. Never throws: a network failure or timeout comes back as
 * status 0. On an error status `json` is dropped (it quotes field values)
 * and only `{ status, type }` is kept.
 */
export async function osFetch(
  cfg: SearchConfig,
  account: Account,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  opts: FetchOptions = {},
): Promise<OsResponse> {
  if (!path.startsWith("/")) throw new Error("OpenSearch path must start with /");
  const headers: Record<string, string> = { accept: "application/json" };
  const auth = authorization(cfg[account]);
  if (auth) headers.authorization = auth;
  let payload: string | undefined;
  if (body !== undefined) {
    headers["content-type"] = opts.ndjson ? "application/x-ndjson" : "application/json";
    payload = typeof body === "string" ? body : JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(`${cfg.url}${path}`, {
      method,
      headers,
      body: payload,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
      cache: "no-store",
      redirect: "error",
    });
  } catch (err) {
    const timeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return { status: 0, json: null, error: { status: 0, type: timeout ? "timeout" : "unreachable" } };
  }
  let json: unknown = null;
  try {
    const text = await res.text();
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (res.status >= 400) return { status: res.status, json: null, error: { status: res.status, type: errorType(json, res.status) } };
  return { status: res.status, json, error: null };
}

// ------------------------------------------------------------------ reads

/**
 * After a read that got no answer, skip OpenSearch for this long. Per server
 * instance (a module variable): it caps what an outage costs each warm
 * instance at one timeout, it does not remove it. A refused query (4xx) or a
 * missing index does not trip it.
 */
const COOL_OFF_MS = 30_000;
const coolUntil = new Map<string, number>();
export function resetCircuit(): void {
  coolUntil.clear();
}

export type SearchHit = { id: string; fields: string[] };

/**
 * Ranked hits for a query body, or null when OpenSearch has no usable answer
 * (not configured, cooling off, unreachable, too slow, refused, no index).
 * Never throws. `size` is capped at MAX_HITS; `_source` is off: rows come from
 * Postgres through the caller's own client. `fields` names the highlighted
 * fields when the body asks for highlights (never their text).
 */
export async function searchHits(
  cfg: SearchConfig | null,
  kind: SearchKind,
  body: Record<string, unknown>,
  opts: { size?: number; timeoutMs?: number; now?: () => number } = {},
): Promise<SearchHit[] | null> {
  if (!cfg) return null;
  const now = opts.now ?? Date.now;
  if ((coolUntil.get(cfg.url) ?? 0) > now()) return null;
  const size = Math.max(1, Math.min(Math.trunc(opts.size ?? MAX_HITS) || 1, MAX_HITS));
  const res = await osFetch(cfg, "search", "POST", `/${cfg.indices[kind]}/_search`, {
    ...body,
    size,
    _source: false,
    track_total_hits: false,
  }, { timeoutMs: opts.timeoutMs ?? 1500 });
  if (res.error) {
    // No index yet (first deploy, a version bump before its reconcile): a normal state, not an outage.
    if (res.error.status === 404) return null;
    if (res.error.status === 0 || res.error.status === 429 || res.error.status >= 500) coolUntil.set(cfg.url, now() + COOL_OFF_MS);
    console.error(`[search] OpenSearch ${kind} search failed (${res.error.status} ${res.error.type}); using Postgres only`);
    return null;
  }
  const hits = (res.json as { hits?: { hits?: { _id?: unknown; highlight?: Record<string, unknown> }[] } } | null)?.hits?.hits;
  if (!Array.isArray(hits)) return null;
  const out: SearchHit[] = [];
  for (const h of hits) {
    if (typeof h._id !== "string") continue;
    out.push({ id: h._id, fields: h.highlight ? Object.keys(h.highlight) : [] });
  }
  return out;
}

/** Ranked ids only: searchHits without the highlight names. */
export async function searchIds(
  cfg: SearchConfig | null,
  kind: SearchKind,
  body: Record<string, unknown>,
  opts: { size?: number; timeoutMs?: number; now?: () => number } = {},
): Promise<string[] | null> {
  const hits = await searchHits(cfg, kind, body, opts);
  return hits ? hits.map((h) => h.id) : null;
}

/**
 * Every id in an index, in pages, for the reconcile (index account: the
 * search account may only run the searches the helpers build). Sorted on the
 * `id` keyword every document carries, so search_after pages are stable.
 * Throws on failure: the reconcile then deletes nothing.
 */
export async function listIndexedIds(cfg: SearchConfig, kind: SearchKind, opts: { page?: number; timeoutMs?: number } = {}): Promise<string[]> {
  const page = Math.max(1, Math.min(opts.page ?? 1000, MAX_HITS));
  const ids: string[] = [];
  let after: unknown[] | undefined;
  for (;;) {
    const res = await osFetch(cfg, "index", "POST", `/${cfg.indices[kind]}/_search`, {
      size: page,
      _source: false,
      track_total_hits: false,
      sort: [{ id: "asc" }],
      query: { match_all: {} },
      ...(after ? { search_after: after } : {}),
    }, { timeoutMs: opts.timeoutMs ?? 20_000 });
    if (res.error) throw new OsRequestError("list ids", res.error);
    const hits = (res.json as { hits?: { hits?: { _id: string; sort?: unknown[] }[] } }).hits?.hits ?? [];
    for (const h of hits) ids.push(h._id);
    const last = hits[hits.length - 1];
    if (hits.length < page || !last?.sort) return ids;
    after = last.sort;
  }
}

/** A failed request, carrying only `{ status, type }`. */
export class OsRequestError extends Error {
  readonly status: number;
  readonly type: string;
  constructor(what: string, e: OsError) {
    super(`OpenSearch ${what} failed (${e.status} ${e.type})`);
    this.name = "OsRequestError";
    this.status = e.status;
    this.type = e.type;
  }
}

// ------------------------------------------------------------------ writes

export type BulkAction = { op: "index"; id: string; doc: Record<string, unknown> } | { op: "delete"; id: string };

/**
 * What became of one action:
 *   ok          written or deleted (status below 300)
 *   superseded  409: the index already holds a version at least as new
 *   gone        404 on a delete: there was nothing to delete
 *   blocked     429 cluster_block_exception: the index is read-only (disk full)
 *   failed      anything else; `type` says what (e.g. index_not_found_exception,
 *               strict_dynamic_mapping_exception, timeout, or a 429
 *               es_rejected_execution_exception: a full queue, not a block)
 */
export type BulkItemResult = "ok" | "superseded" | "gone" | "blocked" | "failed";
export type BulkItem = { id: string; op: "index" | "delete"; result: BulkItemResult; status: number; type?: string };
export type BulkResult = {
  items: BulkItem[];
  ok: number;
  superseded: number;
  gone: number;
  blocked: number;
  failed: number;
  /** Some item failed because the index does not exist (the drain then reconciles that kind). */
  indexMissing: boolean;
};

export const BULK_MAX_ACTIONS = 500;
export const BULK_MAX_BYTES = 5 * 1024 * 1024;

type Line = { id: string; op: "index" | "delete"; text: string; bytes: number };

function linesFor(actions: readonly BulkAction[], version: number): Line[] {
  const enc = new TextEncoder();
  return actions.map((a) => {
    // No `_index`: the path names the index (and the engine refuses one in the body).
    const meta = { _id: a.id, version, version_type: "external_gte" };
    const text = a.op === "index" ? `${JSON.stringify({ index: meta })}\n${JSON.stringify(a.doc)}\n` : `${JSON.stringify({ delete: meta })}\n`;
    return { id: a.id, op: a.op, text, bytes: enc.encode(text).length };
  });
}

/** Split into requests of at most BULK_MAX_ACTIONS actions and BULK_MAX_BYTES bytes (a larger single document goes alone). */
export function chunkLines<T extends { bytes: number }>(lines: readonly T[], maxActions = BULK_MAX_ACTIONS, maxBytes = BULK_MAX_BYTES): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let size = 0;
  for (const l of lines) {
    if (cur.length > 0 && (cur.length >= maxActions || size + l.bytes > maxBytes)) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(l);
    size += l.bytes;
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * A read-only block (the disk's flood stage) answers 429 cluster_block_exception.
 * Any other 429 (es_rejected_execution_exception: the write queue is full) is
 * a passing overload, a plain failure that the lapsing claim retries: it must
 * never make the erase action drop the contacts index.
 */
export function isBlock(status: number, type: string | undefined): boolean {
  return status === 429 && type === "cluster_block_exception";
}

function classify(op: "index" | "delete", status: number, type: string | undefined): BulkItemResult {
  if (status >= 200 && status < 300) return "ok";
  if (status === 409) return "superseded";
  if (status === 404 && op === "delete" && type !== "index_not_found_exception") return "gone";
  if (isBlock(status, type)) return "blocked";
  return "failed";
}

/**
 * Write to one kind's index, every action stamped with `version` as an
 * external version (version_type external_gte): of two overlapping writers
 * the one that read the database later wins, whichever arrives first. One
 * index per request; chunked at 500 actions or 5 MB. `refresh: true` makes
 * the change searchable at once (the drain and the erase); the reconcile
 * sends false and refreshes once at the end.
 */
export async function bulk(
  cfg: SearchConfig,
  kind: SearchKind,
  actions: readonly BulkAction[],
  opts: { version: number; refresh?: boolean; timeoutMs?: number },
): Promise<BulkResult> {
  const out: BulkResult = { items: [], ok: 0, superseded: 0, gone: 0, blocked: 0, failed: 0, indexMissing: false };
  if (!Number.isSafeInteger(opts.version) || opts.version < 0) throw new Error("bulk version must be a non-negative safe integer");
  const path = `/${cfg.indices[kind]}/_bulk?refresh=${opts.refresh ? "true" : "false"}`;
  for (const chunk of chunkLines(linesFor(actions, opts.version))) {
    const res = await osFetch(cfg, "index", "POST", path, chunk.map((l) => l.text).join(""), { ndjson: true, timeoutMs: opts.timeoutMs ?? 20_000 });
    const items = (res.json as { items?: Record<string, { _id?: string; status?: number; error?: { type?: unknown } }>[] } | null)?.items;
    if (res.error || !Array.isArray(items) || items.length !== chunk.length) {
      // The whole request failed (or answered something that is not a bulk
      // response): every action in it shares the outcome. Only a 429
      // cluster_block_exception is anything but a plain failure; a 404 means
      // the index (or the route) is missing, never that a document is already
      // gone.
      const e = res.error ?? { status: 0, type: "bad_response" };
      const result: BulkItemResult = isBlock(e.status, e.type) ? "blocked" : "failed";
      for (const l of chunk) push(out, { id: l.id, op: l.op, result, status: e.status, type: e.type });
      if (e.status === 404 || e.type === "index_not_found_exception") out.indexMissing = true;
      continue;
    }
    items.forEach((item, i) => {
      const line = chunk[i] as Line;
      const [op, r] = (Object.entries(item)[0] ?? ["", {}]) as [string, { status?: number; error?: { type?: unknown } }];
      const status = typeof r.status === "number" ? r.status : 0;
      const t = r.error && typeof r.error.type === "string" && /^[a-z_]{1,80}$/.test(r.error.type) ? r.error.type : r.error ? "error" : undefined;
      const kindOfOp = op === "delete" ? "delete" : "index";
      push(out, { id: line.id, op: kindOfOp, result: classify(kindOfOp, status, t), status, ...(t ? { type: t } : {}) });
      if (t === "index_not_found_exception") out.indexMissing = true;
    });
  }
  return out;
}

function push(out: BulkResult, item: BulkItem): void {
  out.items.push(item);
  out[item.result] += 1;
}

/** "3 failed (strict_dynamic_mapping_exception), 1 blocked": statuses and types only, for logs and search_state. */
export function describeFailures(r: BulkResult): string {
  const types = [...new Set(r.items.filter((i) => i.result === "failed" || i.result === "blocked").map((i) => i.type ?? `http_${i.status}`))];
  const parts: string[] = [];
  if (r.failed) parts.push(`${r.failed} failed`);
  if (r.blocked) parts.push(`${r.blocked} blocked`);
  return parts.length ? `${parts.join(", ")} (${types.slice(0, 4).join(", ")})` : "";
}
