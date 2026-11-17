/*
 * OpenSearch configuration. Pure and import-free, so `node --test` loads it
 * as it is (see website-images.test.ts for the house style).
 *
 * Five variables, on the studio's Vercel project only, Production only,
 * marked Sensitive (docs/ops/opensearch-runbook.md):
 *
 *   OPENSEARCH_URL               https://search.<host>   (http only for 127.0.0.1 / localhost)
 *   OPENSEARCH_SEARCH_USER       the account Caddy lets search, and nothing else
 *   OPENSEARCH_SEARCH_PASSWORD
 *   OPENSEARCH_INDEX_USER        the account that writes, reconciles and reads the status
 *   OPENSEARCH_INDEX_PASSWORD
 *
 * Without OPENSEARCH_URL every search is Postgres only and the sync route
 * discards its outbox rows: an unset URL is a normal state (previews, local
 * development, tests), never an error.
 *
 * The index prefix is the constant "jvb": Caddy names it literally, so a
 * configurable prefix could only ever break search silently. Tests get their
 * own prefix through testSearchConfig() and nothing else.
 */

export type SearchKind = "works" | "makers" | "contacts";
export const SEARCH_KINDS: readonly SearchKind[] = ["works", "makers", "contacts"];

export const INDEX_PREFIX = "jvb";

/**
 * The mapping version of each index. Bump one whenever its mapping or
 * analysis in mappings.ts changes (mappings.test.ts holds a fingerprint that
 * fails until you do): the next reconcile then creates `jvb-<kind>-v<N+1>`,
 * fills it, and deletes the lower versions. Until it has, the merge with
 * Postgres keeps search at today's quality.
 */
export const INDEX_VERSION: Readonly<Record<SearchKind, number>> = { works: 1, makers: 1, contacts: 1 };

export type SearchAccount = { user: string; password: string };

export type SearchConfig = {
  /** Origin only, no trailing slash: "https://search.example.com". */
  url: string;
  /** Used by the search helpers, for POST /<index>/_search only. */
  search: SearchAccount;
  /** Used by the drain, reconcile, the erase action and the Admin status. */
  index: SearchAccount;
  /** The prefix the index names below were built with: always "jvb" outside tests. */
  prefix: string;
  /** The concrete index each kind reads and writes, e.g. "jvb-works-v1". */
  indices: Readonly<Record<SearchKind, string>>;
};

const PREFIX_SHAPE = /^[a-z][a-z0-9-]{0,40}$/;

/** `jvb-works-v1`: the concrete name of a kind's index at a mapping version. No aliases anywhere. */
export function indexName(kind: SearchKind, prefix: string = INDEX_PREFIX, version: number = INDEX_VERSION[kind]): string {
  if (!PREFIX_SHAPE.test(prefix)) throw new Error("search index prefix must be lower-case letters, digits and hyphens");
  if (!Number.isInteger(version) || version < 1) throw new Error("search index version must be a positive integer");
  return `${prefix}-${kind}-v${version}`;
}

function indicesFor(prefix: string): Record<SearchKind, string> {
  return { works: indexName("works", prefix), makers: indexName("makers", prefix), contacts: indexName("contacts", prefix) };
}

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

type Env = Record<string, string | undefined>;

/** Why the environment cannot be used, in words safe to show on the Admin page; null when it can (or is simply unset). */
export function searchConfigProblem(env: Env): string | null {
  return check(env).problem;
}

/** The configuration, or null when OpenSearch is not configured or the variables cannot be used. */
export function searchConfig(env: Env): SearchConfig | null {
  return check(env).config;
}

function check(env: Env): { config: SearchConfig | null; problem: string | null } {
  const raw = (env.OPENSEARCH_URL ?? "").trim();
  if (!raw) return { config: null, problem: null };
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { config: null, problem: "OPENSEARCH_URL is not a URL" };
  }
  // Passwords travel only in the Authorization header, never in a URL that
  // ends up in logs and error messages.
  if (u.username || u.password) return { config: null, problem: "OPENSEARCH_URL must not contain a user name or password" };
  const loopback = LOOPBACK.has(u.hostname);
  if (u.protocol !== "https:" && !(u.protocol === "http:" && loopback)) {
    return { config: null, problem: "OPENSEARCH_URL must use https (http only for 127.0.0.1 or localhost)" };
  }
  // Caddy matches paths from the root (^/jvb-…), so a path prefix would make every request a 404.
  if ((u.pathname !== "/" && u.pathname !== "") || u.search || u.hash) {
    return { config: null, problem: "OPENSEARCH_URL must be the site's address only, with no path or query" };
  }
  const search = account(env.OPENSEARCH_SEARCH_USER, env.OPENSEARCH_SEARCH_PASSWORD);
  const index = account(env.OPENSEARCH_INDEX_USER, env.OPENSEARCH_INDEX_PASSWORD);
  if (!search || !index) return { config: null, problem: "a search user name contains a colon" };
  // A local node with the security plugin off (tests, the preview) needs no
  // accounts; anything else needs both, complete.
  if (!loopback && (!complete(search) || !complete(index))) {
    return { config: null, problem: "OPENSEARCH_SEARCH_USER/PASSWORD and OPENSEARCH_INDEX_USER/PASSWORD must all be set" };
  }
  if ((search.user && !search.password) || (!search.user && search.password) || (index.user && !index.password) || (!index.user && index.password)) {
    return { config: null, problem: "each search account needs both a user name and a password" };
  }
  return { config: { url: u.origin, search, index, prefix: INDEX_PREFIX, indices: indicesFor(INDEX_PREFIX) }, problem: null };
}

function account(user: string | undefined, password: string | undefined): SearchAccount | null {
  const u = (user ?? "").trim();
  if (u.includes(":")) return null; // basic auth splits on the first colon
  return { user: u, password: password ?? "" };
}

const complete = (a: SearchAccount) => a.user.length > 0 && a.password.length > 0;

/**
 * TEST ONLY: a configuration for a local node (security off, no accounts)
 * with the test's own prefix, so integration tests never touch `jvb-*`.
 */
export function testSearchConfig(url: string, prefix: string): SearchConfig {
  if (prefix === INDEX_PREFIX) throw new Error("tests must use their own index prefix");
  const origin = new URL(url).origin;
  const none = { user: "", password: "" };
  return { url: origin, search: none, index: none, prefix, indices: indicesFor(prefix) };
}
