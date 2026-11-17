/*
 * The two machine routes that keep the search index current, as plain
 * functions of (request, dependencies) so node --test can run them without
 * Next.js:
 *
 *   /api/sync/search            POST  the database's pg_net wake-up (migration
 *                                     0100), one per committing transaction,
 *                                     x-sync-secret as /api/sync/sanity checks it
 *                               GET   the 10-minute Vercel cron (CRON_SECRET),
 *                                     for anything a wake-up missed
 *   /api/cron/search-reconcile  GET   the nightly reconcile (CRON_SECRET)
 *
 * The secret is checked before anything else runs; the service client is
 * created only once the cron secret has passed (the pg_net secret needs it to
 * read sync_config, as the sanity route does).
 *
 * Deployment order: this ships before the server and before migration 0100.
 * Without OPENSEARCH_URL the drain still claims and discards (the outbox
 * cannot grow); without 0100 both routes answer 200 { skipped: "not set up" }.
 *
 * Nothing here logs or answers with a query, a document, a body or an engine
 * reason: the answers carry counts, statuses and the indexer's error strings,
 * which hold database codes and OpenSearch error types only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { safeEqual } from "@/lib/secret";
import { searchConfigProblem, type SearchConfig } from "@/lib/opensearch/config";
import { drainSearchOutbox, reconcile, type DrainResult, type ReconcileResult } from "@/lib/opensearch/indexer";

type Db = SupabaseClient;
type Env = Record<string, string | undefined>;

export type RouteDeps = {
  /** The service client: made only once the cron secret passed, or (POST) a secret was presented to check against sync_config. */
  service: () => Db;
  /** searchConfig(process.env): null when OpenSearch is not configured (or not usable). */
  cfg: SearchConfig | null;
  env: Env;
};

/**
 * Outbox rows claimed per round, and rounds per call. An ordinary round (a
 * few saves) takes well under a second; a heavy one, a maker or category
 * rename re-indexing a couple of thousand works with refresh=true, some
 * 20 seconds; a self-heal (a missing index rebuilt from the database) up to a
 * minute or two. Eight rounds of 200 fit inside the routes' maxDuration of
 * 300 s with that margin; whatever is left waits for the next wake-up or the
 * 10-minute cron, and a claim cut off by the time limit lapses after two
 * minutes and is retried.
 */
export const DRAIN_BATCH = 200;
export const DRAIN_ROUNDS = 8;

const unauthorised = () => Response.json({ error: "unauthorized" }, { status: 401 });

/** The Vercel cron's `Authorization: Bearer <CRON_SECRET>`, as the other cron routes check it. */
export function cronAuthorised(request: Request, env: Env): boolean {
  const secret = env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  return !!secret && safeEqual(bearer, secret);
}

/**
 * The x-sync-secret check of /api/sync/sanity: SYNC_SHARED_SECRET, or the
 * secret the database presents from sync_config (the pg_net trigger), which
 * lives only in the database.
 */
export async function syncSecretAuthorised(db: Db, presented: string | null, env: Env): Promise<boolean> {
  if (!presented) return false;
  const envSecret = env.SYNC_SHARED_SECRET;
  if (envSecret && safeEqual(presented, envSecret)) return true;
  const { data } = await db.from("sync_config").select("secret").eq("id", 1).maybeSingle();
  return !!data?.secret && safeEqual(presented, data.secret as string);
}

/** POST /api/sync/search: the database's wake-up. */
export async function drainFromDatabase(request: Request, deps: RouteDeps): Promise<Response> {
  const presented = request.headers.get("x-sync-secret");
  if (!presented) return unauthorised();
  const db = deps.service();
  if (!(await syncSecretAuthorised(db, presented, deps.env))) return unauthorised();
  return drain(db, deps);
}

/** GET /api/sync/search: the 10-minute cron. */
export async function drainFromCron(request: Request, deps: RouteDeps): Promise<Response> {
  if (!cronAuthorised(request, deps.env)) return unauthorised();
  return drain(deps.service(), deps);
}

/** The answer's body: counts and statuses only. */
function drainBody(r: DrainResult) {
  return {
    status: r.status,
    claimed: r.claimed,
    done: r.done,
    left: r.left,
    written: r.written,
    superseded: r.superseded,
    gone: r.gone,
    blocked: r.blocked,
    failed: r.failed,
    healed: r.healed,
    ...(r.error ? { error: r.error } : {}),
  };
}

/** Why there is no configuration: unset, or set but unusable (the Admin page names the problem). */
const notConfigured = (env: Env) => (searchConfigProblem(env) ? "misconfigured" : "not configured");

async function drain(db: Db, { cfg, env }: RouteDeps): Promise<Response> {
  let r: DrainResult;
  try {
    r = await drainSearchOutbox(db, cfg, { batch: DRAIN_BATCH, rounds: DRAIN_ROUNDS });
  } catch {
    // The indexer is written not to throw; if it does, say so without the
    // message (it could quote a value).
    console.error("[search] drain stopped on an unexpected error");
    return Response.json({ error: "drain failed" }, { status: 500 });
  }
  if (r.status === "not set up") return Response.json({ skipped: "not set up" });
  if (r.status === "failed") return Response.json(drainBody(r), { status: 502 });
  // Not configured: the rows were claimed and discarded, nothing was sent.
  if (!cfg) return Response.json({ skipped: notConfigured(env), discarded: r.done });
  return Response.json(drainBody(r));
}

/** GET /api/cron/search-reconcile: the nightly reconcile of all three indices. */
export async function reconcileFromCron(request: Request, deps: RouteDeps): Promise<Response> {
  if (!cronAuthorised(request, deps.env)) return unauthorised();
  if (!deps.cfg) return Response.json({ skipped: notConfigured(deps.env) });
  let r: ReconcileResult;
  try {
    r = await reconcile(deps.service(), deps.cfg);
  } catch {
    console.error("[search] reconcile stopped on an unexpected error");
    return Response.json({ error: "reconcile failed" }, { status: 500 });
  }
  if (r.status === "not set up") return Response.json({ skipped: "not set up" });
  const body = {
    status: r.status,
    kinds: r.kinds.map((k) => ({
      kind: k.kind,
      status: k.status,
      index: k.index,
      created: k.created,
      indexed: k.indexed,
      removed: k.removed,
      superseded: k.superseded,
      failed: k.failed,
      ...(k.error ? { error: k.error } : {}),
    })),
  };
  // Blocked (disk nearly full) or failed shows as a failed run in Vercel's cron log.
  return Response.json(body, { status: r.status === "ok" ? 200 : 502 });
}
