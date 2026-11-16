/*
 * Keeping the indices current: the outbox drain, the reconcile, the erasure
 * delete and the Admin status. Server only, service client, index account.
 * The callers (the sync route, the crons, the Admin page, the erase action)
 * check the secret or the role first; nothing here does.
 *
 * The database side (migration 0100) provides search_outbox,
 * claim_search_outbox(batch), search_clock_ms() and search_state, all
 * service_role only. Until it is applied every function here answers
 * "not set up" instead of throwing; without OPENSEARCH_URL they answer
 * "not configured" (the drain still claims and discards its rows, so the
 * outbox cannot grow while search is switched off).
 *
 * Versions: every write carries the database clock as an external version
 * (version_type external_gte). The drain uses the largest claimed_ms of its
 * batch, read before it loads the rows; the reconcile takes
 * search_clock_ms() before it reads anything. Of two writers the one that
 * read the database later wins, whichever reaches OpenSearch first; a
 * stale write comes back 409 and counts as superseded, which is done.
 *
 * Nothing logged or stored here carries a document, a reason or a search
 * term: statuses, error types, counts and ids only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingFunction } from "@/lib/db-errors";
import { bulk, describeFailures, listIndexedIds, osFetch, type BulkAction, type BulkItemResult, type BulkResult } from "./client";
import { INDEX_VERSION, SEARCH_KINDS, indexName, searchConfigProblem, type SearchConfig, type SearchKind } from "./config";
import { contactDoc, makerDoc, workDoc } from "./documents";
import { indexBody } from "./mappings";
import { contactIdsByOrganization, loadContactSources, loadMakerRows, loadWorkSources, workIdsByCategory, workIdsByMaker } from "./load";

type Db = SupabaseClient;
type PgError = { code?: string; message?: string } | null | undefined;

/** True when the error says migration 0100's table or function is not there (yet). */
export function isNotSetUp(error: PgError, status?: number): boolean {
  if (!error) return false;
  if (isMissingFunction(error)) return true;
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST202" || error.code === "42883") return true;
  if (/could not find the table|relation "?[\w.]*"? does not exist/i.test(error.message ?? "")) return true;
  return status === 404 && !error.code;
}

/** A database error reduced to its code: messages can quote values. */
const dbError = (what: string, e: PgError) => `${what} failed (${e?.code ?? "error"})`;

const now = () => new Date().toISOString();

type StateKind = SearchKind | "drain";

/** Record a run in search_state. Best effort: a missing table or a failed write never fails the run. */
async function writeState(db: Db, kind: StateKind, result: string, error: string | null): Promise<void> {
  try {
    const at = now();
    await db
      .from("search_state")
      .upsert({ kind, last_run_at: at, last_result: result.slice(0, 500), last_error: error ? error.slice(0, 500) : null, updated_at: at }, { onConflict: "kind" });
  } catch {
    // ignore
  }
}

async function databaseClock(db: Db): Promise<{ clock: number } | { notSetUp: true } | { error: string }> {
  const { data, error, status } = await db.rpc("search_clock_ms");
  if (error) return isNotSetUp(error, status) ? { notSetUp: true } : { error: dbError("search_clock_ms", error) };
  const clock = Number(data);
  if (!Number.isSafeInteger(clock) || clock <= 0) return { error: "search_clock_ms returned no time" };
  return { clock };
}

// ------------------------------------------------------------------ documents per kind

/** Build the write actions for ids of one kind from the database (index what exists and may be searched, delete the rest). */
async function actionsFor(db: Db, kind: SearchKind, ids: readonly string[] | "all"): Promise<{ actions: BulkAction[]; kept: Set<string> }> {
  const actions: BulkAction[] = [];
  const kept = new Set<string>();
  const add = (id: string, doc: Record<string, unknown> | null) => {
    if (doc) {
      actions.push({ op: "index", id, doc });
      kept.add(id);
    } else {
      actions.push({ op: "delete", id });
    }
  };
  if (kind === "works") {
    const sources = await loadWorkSources(db, ids);
    const list = ids === "all" ? [...sources.keys()] : ids;
    for (const id of list) add(id, workDoc(sources.get(id)));
  } else if (kind === "makers") {
    const rows = await loadMakerRows(db, ids);
    const list = ids === "all" ? [...rows.keys()] : ids;
    for (const id of list) add(id, makerDoc(rows.get(id)));
  } else {
    const sources = await loadContactSources(db, ids);
    const list = ids === "all" ? [...sources.keys()] : ids;
    for (const id of list) add(id, contactDoc(sources.get(id)));
  }
  return { actions, kept };
}

// ------------------------------------------------------------------ reconcile

export type ReconcileKindResult = {
  kind: SearchKind;
  status: "ok" | "blocked" | "failed" | "not set up";
  index: string;
  created: boolean;
  indexed: number;
  removed: number;
  /** Writes refused because a drain had already written newer data (409). */
  superseded: number;
  failed: number;
  error?: string;
};
export type ReconcileResult = { status: "ok" | "blocked" | "failed" | "not set up" | "not configured"; kinds: ReconcileKindResult[] };

type Ensure = { status: "exists" | "created" } | { status: "blocked" | "failed"; error: string };

/**
 * The current version's index exists, with this build's mapping version.
 * An index of that name with another (or no) `_meta.schema_version` was not
 * made from this code (an automatic creation, say): it is replaced. When the
 * disk watermark blocks index creation (403 index_create_block_exception)
 * nothing is deleted and the old version keeps serving.
 */
export async function ensureIndex(cfg: SearchConfig, kind: SearchKind): Promise<Ensure> {
  const name = cfg.indices[kind];
  const mapping = await osFetch(cfg, "index", "GET", `/${name}/_mapping`);
  if (!mapping.error) {
    const meta = (mapping.json as Record<string, { mappings?: { _meta?: { schema_version?: unknown } } }> | null)?.[name]?.mappings?._meta;
    if (meta?.schema_version === INDEX_VERSION[kind]) return { status: "exists" };
    const dropped = await osFetch(cfg, "index", "DELETE", `/${name}`);
    if (dropped.error && dropped.error.status !== 404) return { status: "failed", error: `replace ${name} (${dropped.error.status} ${dropped.error.type})` };
  } else if (mapping.error.status !== 404) {
    return { status: "failed", error: `read ${name} (${mapping.error.status} ${mapping.error.type})` };
  }
  const made = await osFetch(cfg, "index", "PUT", `/${name}`, indexBody(kind, INDEX_VERSION[kind]), { timeoutMs: 30_000 });
  if (!made.error) return { status: "created" };
  if (made.error.type === "resource_already_exists_exception") return { status: "exists" };
  if (made.error.type === "index_create_block_exception" || made.error.status === 403) {
    return { status: "blocked", error: "index creation is blocked (disk nearly full); the old index is kept" };
  }
  return { status: "failed", error: `create ${name} (${made.error.status} ${made.error.type})` };
}

/** Reconcile one kind: create the index if missing, upsert every record, remove what the database no longer has, drop lower versions. */
export async function reconcileKind(db: Db, cfg: SearchConfig, kind: SearchKind): Promise<ReconcileKindResult> {
  const name = cfg.indices[kind];
  const result: ReconcileKindResult = { kind, status: "ok", index: name, created: false, indexed: 0, removed: 0, superseded: 0, failed: 0 };
  const finish = async (r: ReconcileKindResult) => {
    if (r.status !== "not set up") {
      const summary = `${r.status}: ${r.indexed} indexed, ${r.removed} removed, ${r.superseded} kept newer${r.created ? ", index created" : ""}`;
      await writeState(db, kind, summary, r.error ?? null);
    }
    if (r.status === "blocked" || r.status === "failed") console.error(`[search] reconcile ${kind}: ${r.status}${r.error ? ` (${r.error})` : ""}`);
    return r;
  };

  // 1. The clock first: everything read after it is at least this fresh.
  const clock = await databaseClock(db);
  if ("notSetUp" in clock) return finish({ ...result, status: "not set up" });
  if ("error" in clock) return finish({ ...result, status: "failed", error: clock.error });

  // 2. The index.
  const ensured = await ensureIndex(cfg, kind);
  if (ensured.status === "blocked" || ensured.status === "failed") return finish({ ...result, status: ensured.status, error: ensured.error });
  result.created = ensured.status === "created";

  // 3. Every record, at the clock's version.
  let built: { actions: BulkAction[]; kept: Set<string> };
  try {
    built = await actionsFor(db, kind, "all");
  } catch {
    return finish({ ...result, status: "failed", error: "loading rows failed" });
  }
  const up = await bulk(cfg, kind, built.actions, { version: clock.clock, refresh: false, timeoutMs: 60_000 });
  result.indexed = up.ok;
  result.superseded = up.superseded;
  result.failed = up.failed + up.blocked;
  if (up.blocked || up.failed) {
    return finish({ ...result, status: up.blocked ? "blocked" : "failed", error: `upsert: ${describeFailures(up)}` });
  }

  // 4. Whatever the index holds that the database does not, at the same version:
  //    a record created (and drained) since the clock has a newer version and stays.
  let indexed: string[];
  try {
    indexed = await listIndexedIds(cfg, kind);
  } catch (err) {
    return finish({ ...result, status: "failed", error: err instanceof Error ? err.message : "listing ids failed" });
  }
  const stale = indexed.filter((id) => !built.kept.has(id));
  const del = await bulk(cfg, kind, stale.map((id) => ({ op: "delete" as const, id })), { version: clock.clock, refresh: false, timeoutMs: 60_000 });
  result.removed = del.ok;
  result.superseded += del.superseded;
  if (del.blocked || del.failed) {
    result.failed += del.failed + del.blocked;
    return finish({ ...result, status: del.blocked ? "blocked" : "failed", error: `remove: ${describeFailures(del)}` });
  }
  await osFetch(cfg, "index", "POST", `/${name}/_refresh`, undefined, { timeoutMs: 30_000 });

  // 5. Lower versions of this kind, by exact name (never a wildcard), now that this one is full.
  for (let v = 1; v < INDEX_VERSION[kind]; v++) {
    const old = indexName(kind, cfg.prefix, v);
    const gone = await osFetch(cfg, "index", "DELETE", `/${old}`, undefined, { timeoutMs: 30_000 });
    if (gone.error && gone.error.status !== 404) result.error = `old ${old} not deleted (${gone.error.status} ${gone.error.type})`;
  }

  // 6. Contacts: merge away deleted documents, which bounds how long erased data stays on disk.
  if (kind === "contacts") {
    const merged = await osFetch(cfg, "index", "POST", `/${name}/_forcemerge?only_expunge_deletes=true`, undefined, { timeoutMs: 120_000 });
    if (merged.error) result.error = `forcemerge (${merged.error.status} ${merged.error.type})`;
  }
  return finish(result);
}

/** Reconcile the given kinds (default: all three), one after another, each with its own clock. */
export async function reconcile(db: Db, cfg: SearchConfig | null, kinds: readonly SearchKind[] = SEARCH_KINDS): Promise<ReconcileResult> {
  if (!cfg) return { status: "not configured", kinds: [] };
  const results: ReconcileKindResult[] = [];
  for (const kind of kinds) {
    const r = await reconcileKind(db, cfg, kind);
    results.push(r);
    if (r.status === "not set up") return { status: "not set up", kinds: results };
  }
  const status = results.some((r) => r.status === "failed") ? "failed" : results.some((r) => r.status === "blocked") ? "blocked" : "ok";
  return { status, kinds: results };
}

// ------------------------------------------------------------------ drain

type ClaimRow = { id: number; entity_type: string; entity_id: string; claimed_ms: number };

export type DrainResult = {
  status: "ok" | "partial" | "not set up" | "not configured" | "failed";
  /** Outbox rows claimed. */
  claimed: number;
  /** Rows finished and deleted (or, not configured, discarded). */
  done: number;
  /** Rows left claimed; their claims lapse after two minutes and the next drain retries them. */
  left: number;
  written: number;
  superseded: number;
  gone: number;
  blocked: number;
  failed: number;
  /** Kinds whose index was missing and were rebuilt by a reconcile first. */
  healed: SearchKind[];
  error?: string;
};

const DONE: ReadonlySet<BulkItemResult> = new Set(["ok", "superseded", "gone"]);

function emptyDrain(): DrainResult {
  return { status: "ok", claimed: 0, done: 0, left: 0, written: 0, superseded: 0, gone: 0, blocked: 0, failed: 0, healed: [] };
}

async function deleteOutboxRows(db: Db, ids: readonly number[]): Promise<string | null> {
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await db.from("search_outbox").delete().in("id", ids.slice(i, i + 100));
    if (error) return dbError("deleting outbox rows", error);
  }
  return null;
}

/**
 * Claim outbox rows, de-duplicate them, read each record's CURRENT state
 * after the claim, write it (or remove it) at version max(claimed_ms) with
 * refresh=true, and delete the rows whose every item came back ok,
 * superseded or gone. A blocked or failed item leaves its row's claim to
 * lapse. A 'maker' row re-indexes the maker and its works, a 'category' row
 * its works, an 'organization' row its contacts. When a kind's index is
 * missing, that kind is reconciled first (which also covers the batch).
 * Runs up to `rounds` batches while full batches keep coming.
 */
export async function drainSearchOutbox(
  db: Db,
  cfg: SearchConfig | null,
  opts: { batch?: number; rounds?: number } = {},
): Promise<DrainResult> {
  const batch = Math.max(1, Math.min(Math.trunc(opts.batch ?? 200) || 200, 1000));
  const rounds = Math.max(1, Math.min(Math.trunc(opts.rounds ?? 5) || 5, 50));
  const total = emptyDrain();
  for (let round = 0; round < rounds; round++) {
    const { data, error, status } = await db.rpc("claim_search_outbox", { batch });
    if (error) {
      if (isNotSetUp(error, status)) return { ...total, status: "not set up" };
      total.status = "failed";
      total.error = dbError("claim_search_outbox", error);
      break;
    }
    const rows = ((data ?? []) as ClaimRow[]).filter((r) => r && typeof r.entity_id === "string");
    if (rows.length === 0) break;
    total.claimed += rows.length;

    if (!cfg) {
      // Not configured: nothing to write to. Discard, so the outbox cannot grow.
      const err = await deleteOutboxRows(db, rows.map((r) => Number(r.id)));
      if (err) {
        total.left += rows.length;
        total.error = err;
        total.status = "failed";
        break;
      }
      total.done += rows.length;
      total.status = "not configured";
      if (rows.length < batch) break;
      continue;
    }

    const r = await drainBatch(db, cfg, rows);
    total.done += r.done;
    total.left += r.left;
    total.written += r.written;
    total.superseded += r.superseded;
    total.gone += r.gone;
    total.blocked += r.blocked;
    total.failed += r.failed;
    for (const k of r.healed) if (!total.healed.includes(k)) total.healed.push(k);
    if (r.error) total.error = r.error;
    if (r.left > 0 || r.error) {
      total.status = total.done > 0 ? "partial" : "failed";
      break; // do not spin on what is failing; the claims lapse and the next drain retries
    }
    if (rows.length < batch) break;
  }
  if (total.claimed > 0 && total.status !== "not configured") {
    await writeState(
      db,
      "drain",
      `${total.status}: ${total.claimed} claimed, ${total.done} done, ${total.left} left${total.healed.length ? `, rebuilt ${total.healed.join(" ")}` : ""}`,
      total.error ?? (total.blocked ? `${total.blocked} blocked (index read-only)` : total.failed ? `${total.failed} failed` : null),
    );
  }
  return total;
}

type Item = { kind: SearchKind; id: string };

async function drainBatch(db: Db, cfg: SearchConfig, rows: readonly ClaimRow[]): Promise<Omit<DrainResult, "status" | "claimed"> & { error?: string }> {
  const out = { done: 0, left: 0, written: 0, superseded: 0, gone: 0, blocked: 0, failed: 0, healed: [] as SearchKind[], error: undefined as string | undefined };
  const version = Math.max(...rows.map((r) => Number(r.claimed_ms)));
  const of = (type: string) => [...new Set(rows.filter((r) => r.entity_type === type).map((r) => r.entity_id))];

  // Fan out: which documents each outbox row stands for. A fan-out query that
  // fails leaves its rows unfinished.
  const failedRows = new Set<number>();
  const fan = async (type: string, load: () => Promise<Map<string, string[]>>): Promise<Map<string, string[]>> => {
    if (of(type).length === 0) return new Map();
    try {
      return await load();
    } catch {
      for (const r of rows) if (r.entity_type === type) failedRows.add(r.id);
      out.error = `loading the records of ${type} rows failed`;
      return new Map();
    }
  };
  const [worksOfMaker, worksOfCategory, contactsOfOrg] = await Promise.all([
    fan("maker", () => workIdsByMaker(db, of("maker"))),
    fan("category", () => workIdsByCategory(db, of("category"))),
    fan("organization", () => contactIdsByOrganization(db, of("organization"))),
  ]);
  const itemsOf = new Map<number, Item[]>();
  for (const r of rows) {
    const items: Item[] = [];
    if (r.entity_type === "work") items.push({ kind: "works", id: r.entity_id });
    else if (r.entity_type === "maker") {
      items.push({ kind: "makers", id: r.entity_id });
      for (const w of worksOfMaker.get(r.entity_id) ?? []) items.push({ kind: "works", id: w });
    } else if (r.entity_type === "category") {
      for (const w of worksOfCategory.get(r.entity_id) ?? []) items.push({ kind: "works", id: w });
    } else if (r.entity_type === "contact") items.push({ kind: "contacts", id: r.entity_id });
    else if (r.entity_type === "organization") {
      for (const c of contactsOfOrg.get(r.entity_id) ?? []) items.push({ kind: "contacts", id: c });
    }
    itemsOf.set(r.id, items);
  }

  // One write per kind, de-duplicated.
  const results = new Map<string, BulkItemResult>();
  const key = (kind: SearchKind, id: string) => `${kind}:${id}`;
  for (const kind of SEARCH_KINDS) {
    const ids = [...new Set([...itemsOf.values()].flat().filter((i) => i.kind === kind).map((i) => i.id))];
    if (ids.length === 0) continue;
    let res: BulkResult;
    try {
      const { actions } = await actionsFor(db, kind, ids);
      res = await bulk(cfg, kind, actions, { version, refresh: true });
    } catch {
      for (const id of ids) results.set(key(kind, id), "failed");
      out.failed += ids.length;
      out.error = `loading ${kind} failed`;
      continue;
    }
    if (res.indexMissing) {
      // Self-heal: build the index from the database. Its clock is taken now,
      // after this batch's claim, so it covers every item of the batch.
      const healed = await reconcileKind(db, cfg, kind);
      const outcome: BulkItemResult = healed.status === "ok" ? "ok" : healed.status === "blocked" ? "blocked" : "failed";
      if (healed.status === "ok") out.healed.push(kind);
      else out.error = `rebuilding ${kind}: ${healed.status}${healed.error ? ` (${healed.error})` : ""}`;
      for (const id of ids) results.set(key(kind, id), outcome);
      if (outcome === "ok") out.written += ids.length;
      else if (outcome === "blocked") out.blocked += ids.length;
      else out.failed += ids.length;
      continue;
    }
    for (const item of res.items) results.set(key(kind, item.id), item.result);
    out.written += res.ok;
    out.superseded += res.superseded;
    out.gone += res.gone;
    out.blocked += res.blocked;
    out.failed += res.failed;
    if (res.failed || res.blocked) {
      const e = `${kind}: ${describeFailures(res)}`;
      out.error = out.error ? `${out.error}; ${e}` : e;
      console.error(`[search] drain ${e}`);
    }
  }

  const finished: number[] = [];
  for (const r of rows) {
    if (failedRows.has(r.id)) continue;
    const items = itemsOf.get(r.id) ?? [];
    if (items.every((i) => DONE.has(results.get(key(i.kind, i.id)) ?? "failed"))) finished.push(Number(r.id));
  }
  const delErr = await deleteOutboxRows(db, finished);
  if (delErr) {
    out.error = delErr;
    out.left = rows.length;
    return out;
  }
  out.done = finished.length;
  out.left = rows.length - finished.length;
  return out;
}

// ------------------------------------------------------------------ erasure

/** Above any database clock: once erased, no write that was already in flight can bring the document back. */
export const ERASE_VERSION = Number.MAX_SAFE_INTEGER;

export type EraseResult = { status: "deleted" | "gone" | "index dropped" | "not configured" | "failed"; error?: string };

/**
 * Remove one contact from the index at once (refresh=true), for the erase
 * action: after erase_contact() succeeds and before the request is marked
 * complete. When the index is read-only (disk full, 429) the whole contacts
 * index is deleted instead; search falls back to Postgres until the next
 * reconcile recreates it. Never throws: a failure must not block the erasure
 * (the outbox row stays and the drain or the reconcile finishes the job).
 */
export async function deleteContactFromIndex(cfg: SearchConfig | null, id: string): Promise<EraseResult> {
  if (!cfg) return { status: "not configured" };
  try {
    const res = await bulk(cfg, "contacts", [{ op: "delete", id }], { version: ERASE_VERSION, refresh: true, timeoutMs: 10_000 });
    const item = res.items[0];
    if (res.indexMissing) return { status: "gone" };
    if (item?.result === "ok") return { status: "deleted" };
    if (item?.result === "gone" || item?.result === "superseded") return { status: "gone" };
    if (item?.result === "blocked") {
      const dropped = await osFetch(cfg, "index", "DELETE", `/${cfg.indices.contacts}`, undefined, { timeoutMs: 30_000 });
      if (!dropped.error || dropped.error.status === 404) return { status: "index dropped" };
      return { status: "failed", error: `index read-only and could not be dropped (${dropped.error.status} ${dropped.error.type})` };
    }
    return { status: "failed", error: `delete failed (${item?.status ?? 0} ${item?.type ?? "unknown"})` };
  } catch {
    return { status: "failed", error: "delete failed" };
  }
}

// ------------------------------------------------------------------ status

export type EngineState = "not configured" | "misconfigured" | "ok" | "unreachable" | "disk-full" | "read-only";

export type IndexStatus = {
  kind: SearchKind;
  name: string;
  exists: boolean;
  health: string | null;
  documents: number | null;
  deletedDocuments: number | null;
  size: string | null;
  readOnly: boolean;
  /** Records the database holds for this index (works outside the trash, makers, contacts not erased). */
  database: number | null;
};

export type StateRow = { lastRunAt: string | null; lastResult: string | null; lastError: string | null };

export type SearchStatus = {
  engine: EngineState;
  health: string | null;
  /** Why, in words safe to show (never a password or an engine reason). */
  problem: string | null;
  indices: IndexStatus[];
  /** Other jvb-<kind>-v<N> indices still on the node (a lower version waiting for its reconcile). */
  otherIndices: string[];
  /** False until migration 0100 is applied. */
  setUp: boolean;
  /** Outbox rows waiting (null when not set up). */
  pending: number | null;
  state: Partial<Record<StateKind, StateRow>>;
};

async function count(q: PromiseLike<{ count: number | null; error: PgError; status?: number }>): Promise<{ n: number | null; notSetUp: boolean }> {
  const { count: n, error, status } = await q;
  if (error) return { n: null, notSetUp: isNotSetUp(error, status) };
  return { n: n ?? 0, notSetUp: false };
}

/** Everything the Admin "Search" section shows. Never throws. */
export async function searchStatus(db: Db, cfg: SearchConfig | null): Promise<SearchStatus> {
  const head = { count: "exact" as const, head: true };
  const [jvb, external, makers, contacts, outbox, stateRes] = await Promise.all([
    count(db.from("pieces").select("id", head).is("deleted_at", null)),
    count(db.from("external_pieces").select("id", head).is("deleted_at", null)),
    count(db.from("makers").select("id", head)),
    count(db.from("crm_contacts").select("id", head).is("erased_at", null)),
    count(db.from("search_outbox").select("id", head)),
    db.from("search_state").select("kind, last_run_at, last_result, last_error"),
  ]);
  const database: Record<SearchKind, number | null> = {
    works: jvb.n === null || external.n === null ? null : jvb.n + external.n,
    makers: makers.n,
    contacts: contacts.n,
  };
  const state: Partial<Record<StateKind, StateRow>> = {};
  for (const row of ((stateRes.error ? [] : stateRes.data) ?? []) as { kind: StateKind; last_run_at: string | null; last_result: string | null; last_error: string | null }[]) {
    state[row.kind] = { lastRunAt: row.last_run_at, lastResult: row.last_result, lastError: row.last_error };
  }
  const setUp = !outbox.notSetUp;

  const prefix = cfg?.prefix ?? "jvb";
  const indices: IndexStatus[] = SEARCH_KINDS.map((kind) => ({
    kind,
    name: cfg?.indices[kind] ?? indexName(kind),
    exists: false,
    health: null,
    documents: null,
    deletedDocuments: null,
    size: null,
    readOnly: false,
    database: database[kind],
  }));
  const status: SearchStatus = { engine: "ok", health: null, problem: null, indices, otherIndices: [], setUp, pending: setUp ? outbox.n : null, state };

  if (!cfg) {
    const problem = searchConfigProblem(process.env);
    return { ...status, engine: problem ? "misconfigured" : "not configured", problem };
  }

  const health = await osFetch(cfg, "index", "GET", "/_cluster/health", undefined, { timeoutMs: 5000 });
  if (health.error) {
    return { ...status, engine: "unreachable", problem: `health check failed (${health.error.status} ${health.error.type})` };
  }
  status.health = ((health.json as { status?: unknown } | null)?.status as string | undefined) ?? null;

  const settings = await osFetch(cfg, "index", "GET", "/_cluster/settings?flat_settings=true", undefined, { timeoutMs: 5000 });
  const flat = { ...((settings.json as { persistent?: Record<string, unknown> } | null)?.persistent ?? {}), ...((settings.json as { transient?: Record<string, unknown> } | null)?.transient ?? {}) };
  const on = (k: string) => String(flat[k] ?? "") === "true";
  if (on("cluster.blocks.read_only") || on("cluster.blocks.read_only_allow_delete")) status.engine = "read-only";
  else if (on("cluster.blocks.create_index")) status.engine = "disk-full";

  const cat = await osFetch(cfg, "index", "GET", `/_cat/indices/${prefix}-*?format=json&h=index,health,docs.count,docs.deleted,store.size`, undefined, { timeoutMs: 5000 });
  const rows = Array.isArray(cat.json) ? (cat.json as Record<string, string | undefined>[]) : [];
  const current = new Set(indices.map((i) => i.name));
  const num = (v: string | undefined) => (v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
  for (const row of rows) {
    const name = row.index ?? "";
    const entry = indices.find((i) => i.name === name);
    if (entry) {
      entry.exists = true;
      entry.health = row.health ?? null;
      entry.documents = num(row["docs.count"]);
      entry.deletedDocuments = num(row["docs.deleted"]);
      entry.size = row["store.size"] ?? null;
    } else if (!current.has(name) && /-(works|makers|contacts)-v\d+$/.test(name)) {
      status.otherIndices.push(name);
    }
  }
  for (const entry of indices) {
    if (!entry.exists) continue;
    const s = await osFetch(cfg, "index", "GET", `/${entry.name}/_settings`, undefined, { timeoutMs: 5000 });
    const blocks = (s.json as Record<string, { settings?: { index?: { blocks?: Record<string, unknown> } } }> | null)?.[entry.name]?.settings?.index?.blocks;
    if (blocks && (String(blocks.read_only_allow_delete) === "true" || String(blocks.read_only) === "true")) {
      entry.readOnly = true;
      status.engine = "read-only";
    }
  }
  return status;
}
