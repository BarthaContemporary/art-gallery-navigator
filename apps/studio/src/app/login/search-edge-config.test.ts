// node --test apps/studio/src/app/login/search-edge-config.test.ts
// The studio's search engine (OpenSearch) has no password of its own: the
// search site in infra/compose/Caddyfile is its whole gate. These checks read
// that block, turn it into rules (which login may send which method to which
// request target) and run a long list of requests that must and must not get
// through, as auth-server-config.test.ts does for the API snippet. They also
// hold the engine settings the gate relies on (docker-compose.yml), the
// runbook's substitutions and every line of infra/scripts/verify-search-edge.sh
// to the same rules, so none of them can drift from the block.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";

const root = new URL("../../../../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

/** One Caddyfile directive, with the block it opens (null for a plain line). */
type Directive = { line: string; children: Directive[] | null };

/**
 * The Caddyfile as a tree, comments and blank lines removed. A backtick token
 * may run over several lines (the admin matcher's expression does); its lines
 * are joined into one directive.
 */
function caddyTree(text: string): Directive[] {
  const top: Directive[] = [];
  const stack: Directive[][] = [top];
  let pending: string | null = null;
  for (const raw of text.split("\n")) {
    if (pending !== null) {
      pending += "\n" + raw.trim();
      if ((raw.match(/`/g) ?? []).length % 2 === 0) continue;
      stack.at(-1)!.push({ line: pending, children: null });
      pending = null;
      continue;
    }
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if ((line.match(/`/g) ?? []).length % 2 === 1) {
      pending = line;
      continue;
    }
    if (line === "}") {
      assert.ok(stack.length > 1, "Caddyfile braces balance");
      stack.pop();
    } else if (line.endsWith("{")) {
      const node: Directive = { line: line.slice(0, -1).trim(), children: [] };
      stack.at(-1)!.push(node);
      stack.push(node.children!);
    } else {
      stack.at(-1)!.push({ line, children: null });
    }
  }
  assert.equal(pending, null, "backticks close");
  assert.equal(stack.length, 1, "Caddyfile braces balance");
  return top;
}

const allLines = (nodes: Directive[]): string[] => nodes.flatMap((n) => [n.line, ...allLines(n.children ?? [])]);
const kids = (n: Directive | undefined) => (n?.children ?? []).map((c) => c.line);

const SITE = "search.example.com";
const UPSTREAM = "reverse_proxy 127.0.0.1:9200";
const KINDS = ["contacts", "makers", "works"];
const STATUS_LIST = "/_cat/indices/jvb-*?format=json&h=index,health,docs.count,docs.deleted,store.size";
// The house refusal of targets not in their plain form (as in supabase_api,
// for every path here).
const NONCANONICAL = "^[^?]*([%]|//|/[.][.]?(/|[?]|$))";

type Clause = { method: string; source: string; test: (target: string) => boolean };
type Rule = { matcher: string; clauses: Clause[]; users: string[]; maxSize: string };
type Login = "none" | "wrong" | "jvb-search" | "jvb-index";
type Outcome = "engine" | 400 | 401 | 404;

/** One `(method('X') && <target test>)` clause, or a bare target test whose method comes from a `method` line. */
function parseClause(raw: string, method: string | null): Clause {
  let text = raw.trim();
  if (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1).trim();
  const bound = /^method\('([A-Z]+)'\) && (.*)$/s.exec(text);
  const m = bound ? bound[1]! : method;
  const rest = bound ? bound[2]!.trim() : text;
  assert.ok(m, `clause without a method: ${raw}`);
  assert.ok(!(bound && method), `two methods for one clause: ${raw}`);
  const re = /^\{http\.request\.orig_uri\}\.matches\("([^"]+)"\)$/.exec(rest);
  const lit = /^\{http\.request\.orig_uri\} == "([^"]+)"$/.exec(rest);
  if (re) {
    const source = re[1]!;
    assert.ok(source.startsWith("^") && source.endsWith("$"), `pattern not anchored: ${source}`);
    // RE2 (Caddy) and JavaScript read these the same only without escapes.
    assert.ok(!source.includes("\\"), `pattern uses a backslash: ${source}`);
    const rx = new RegExp(source);
    return { method: m, source, test: (t) => rx.test(t) };
  }
  if (lit) {
    const source = lit[1]!;
    return { method: m, source, test: (t) => t === source };
  }
  assert.fail(`clause not understood: ${raw}`);
}

function parseExpression(directive: string, method: string | null): Clause[] {
  const e = /^expression `([\s\S]*)`$/.exec(directive);
  assert.ok(e, `not an expression: ${directive}`);
  return e[1]!.trim().split("||").map((c) => parseClause(c, method));
}

const caddyfile = read("infra/compose/Caddyfile");
const tree = caddyTree(caddyfile);
const site = tree.find((n) => n.line === SITE);

/** The block's matchers, handles and the rules they make, read from the file. */
function loadRules() {
  assert.ok(site, `Caddyfile has the ${SITE} site`);
  const body = site.children!;
  const matchers = new Map<string, Clause[]>();
  let noncanonical: string | null = null;
  const rules: Rule[] = [];
  const order: string[] = [];
  let catchAll: Directive | null = null;
  for (const n of body) {
    const named = /^@([a-z_]+)(?: (expression `[\s\S]*`))?$/.exec(n.line);
    if (named) {
      const name = named[1]!;
      assert.ok(!matchers.has(name), `@${name} defined twice`);
      if (named[2]) {
        if (name === "search_noncanonical") {
          noncanonical = /^expression `\{http\.request\.orig_uri\}\.matches\("([^"]+)"\)`$/.exec(named[2])?.[1] ?? null;
          matchers.set(name, []);
          continue;
        }
        assert.equal(n.children, null);
        matchers.set(name, parseExpression(named[2], null));
      } else {
        const lines = kids(n);
        const method = lines.find((l) => l.startsWith("method "));
        const expr = lines.filter((l) => l.startsWith("expression "));
        assert.equal(lines.length, method ? 2 : 1, `@${name} holds one method line and one expression, nothing else`);
        assert.equal(expr.length, 1, `@${name} has one expression`);
        const verbs = method?.slice("method ".length).split(" ") ?? [];
        assert.ok(verbs.length <= 1, `@${name} binds one method, not ${verbs.join(" ")}`);
        matchers.set(name, parseExpression(expr[0]!, verbs[0] ?? null));
      }
      continue;
    }
    const handle = /^handle(?: @([a-z_]+))?$/.exec(n.line);
    if (handle) {
      assert.equal(catchAll, null, "the catch-all handle comes last");
      if (!handle[1]) {
        catchAll = n;
        continue;
      }
      const name = handle[1];
      order.push(name);
      if (name === "search_noncanonical") {
        assert.deepEqual(kids(n), ['respond "Bad request" 400']);
        continue;
      }
      const clauses = matchers.get(name);
      assert.ok(clauses, `handle @${name} has a matcher defined before it`);
      // Exactly this shape: a size limit, a login, the engine without the password.
      const lines = kids(n);
      assert.equal(lines.length, 3, `handle @${name}: request_body, basic_auth, reverse_proxy and nothing else`);
      const [limit, auth, proxy] = n.children!;
      assert.equal(limit!.line, "request_body");
      const size = kids(limit);
      assert.equal(size.length, 1);
      assert.match(size[0]!, /^max_size [0-9]+(KB|MB)$/);
      assert.equal(auth!.line, "basic_auth");
      const users = kids(auth).map((l) => {
        const [user, hash, ...extra] = l.split(/\s+/);
        assert.deepEqual(extra, [], l);
        // Never a real hash in the repository: the runbook puts those in on the server.
        assert.equal(hash, `$2a$10$CHANGE_ME_bcrypt_hash_for_${user}`, `${user}'s hash is the placeholder`);
        return user!;
      });
      assert.ok(users.length >= 1);
      assert.equal(proxy!.line, UPSTREAM, `handle @${name} proxies to the engine on loopback only`);
      assert.deepEqual(kids(proxy), ["header_up -Authorization"], "the password is not handed on");
      rules.push({ matcher: name, clauses, users, maxSize: size[0]!.slice("max_size ".length) });
      continue;
    }
  }
  assert.ok(catchAll, "the site ends with a catch-all handle");
  assert.deepEqual(kids(catchAll), ['respond "Not found" 404'], "the catch-all answers 404 and sends nothing on");
  assert.equal(order[0], "search_noncanonical", "targets not in their plain form are refused first");
  assert.equal(noncanonical, NONCANONICAL, "the plain-form check is the house pattern, run on the target as sent");
  return { rules, noncanonical: new RegExp(noncanonical!) };
}

const { rules, noncanonical } = loadRules();

/** What the search site does with a request: who answers, and how. */
function edge(method: string, target: string, login: Login): Outcome {
  if (noncanonical.test(target)) return 400;
  const hits = rules.filter((r) => r.clauses.some((c) => c.method === method && c.test(target)));
  assert.ok(hits.length <= 1, `${method} ${target} matches more than one handle: ${hits.map((h) => h.matcher).join(", ")}`);
  if (hits.length === 0) return 404;
  return hits[0]!.users.includes(login) ? "engine" : 401;
}
const LOGINS: Login[] = ["none", "wrong", "jvb-search", "jvb-index"];
const who = (method: string, target: string) => LOGINS.filter((l) => edge(method, target, l) === "engine").join(",");

test("the search site has exactly the expected parts", () => {
  const lines = site!.children!.map((n) => n.line.split(/\s/)[0]);
  const allowed = new Set(["import", "log", "handle"]);
  for (const l of lines) assert.ok(allowed.has(l!) || l!.startsWith("@"), `unexpected directive in the search site: ${l}`);
  assert.equal(site!.children![0]!.line, "import security_headers");
  const log = site!.children!.find((n) => n.line === "log");
  assert.deepEqual(log?.children?.map((c) => (c.children ? { [c.line]: kids(c) } : c.line)), [
    { "output file /var/log/caddy/search-access.log": ["roll_size 10MiB", "roll_keep 3"] },
    "format json",
  ]);
  const text = allLines(site!.children!);
  assert.ok(!text.some((l) => /^(path|path_regexp|rewrite|uri|route|redir|reverse_proxy)\b/.test(l) && !l.startsWith(UPSTREAM)), "no path matcher, rewrite or other proxy");
  assert.ok(!text.some((l) => /(^|\s)path(_regexp)?\(|\{path\}|\{http\.request\.uri(\.path)?\}/.test(l)), "matchers read the target as sent, never Caddy's cleaned copy");
  assert.ok(!caddyfile.includes("_aliases\""), "no alias requests: the studio uses versioned indices only");
  assert.ok(!/[\s"^]\/health\b/.test(text.join("\n")), "no /health path: there is no way in without a password");
  // Only this site reaches the engine.
  for (const block of tree) {
    if (block === site) continue;
    assert.ok(!allLines(block.children ?? []).some((l) => /127\.0\.0\.1:9200|localhost:9200/.test(l)), `${block.line} must not reach the engine`);
  }
});

test("every shape is anchored, bound to one method and behind a login", () => {
  assert.deepEqual(rules.map((r) => r.matcher), ["search_query", "index_bulk", "index_admin"]);
  for (const r of rules) {
    assert.ok(r.users.length >= 1);
    for (const c of r.clauses) assert.match(c.method, /^(GET|POST|PUT|DELETE)$/, c.source);
  }
  const sizes = Object.fromEntries(rules.map((r) => [r.matcher, r.maxSize]));
  assert.deepEqual(sizes, { search_query: "64KB", index_bulk: "16MB", index_admin: "1MB" });
  // The search password, which travels with every search, appears nowhere else.
  const users = Object.fromEntries(rules.map((r) => [r.matcher, r.users.sort().join(",")]));
  assert.deepEqual(users, { search_query: "jvb-index,jvb-search", index_bulk: "jvb-index", index_admin: "jvb-index" });
  // Every index pattern names the same kinds, which are the studio's.
  for (const r of rules) {
    for (const c of r.clauses) {
      if (!c.source.startsWith("^/jvb-")) continue;
      assert.ok(c.source.startsWith("^/jvb-(works|makers|contacts)-v[0-9]+"), `${c.source} names exactly the three versioned kinds`);
    }
  }
});

test("what the studio sends gets through, to the right login only", () => {
  for (const kind of KINDS) {
    for (const v of ["1", "2", "12"]) {
      const index = `/jvb-${kind}-v${v}`;
      assert.equal(who("POST", `${index}/_search`), "jvb-search,jvb-index", `search ${index}`);
      for (const [m, t] of [
        ["POST", `${index}/_bulk`],
        ["POST", `${index}/_bulk?refresh=true`],
        ["POST", `${index}/_bulk?refresh=false`],
        ["PUT", index],
        ["DELETE", index],
        ["POST", `${index}/_refresh`],
        ["POST", `${index}/_forcemerge?only_expunge_deletes=true`],
        ["GET", `${index}/_count`],
        ["GET", `${index}/_mapping`],
        ["GET", `${index}/_settings`],
      ] as const) {
        assert.equal(who(m, t), "jvb-index", `${m} ${t}`);
      }
    }
  }
  for (const t of ["/_cluster/health", "/_cluster/settings?flat_settings=true", STATUS_LIST]) assert.equal(who("GET", t), "jvb-index", t);
});

test("the search login cannot write or read the engine's state, and nobody gets in without a password", () => {
  for (const [m, t] of [
    ["POST", "/jvb-works-v1/_bulk"],
    ["POST", "/jvb-contacts-v1/_bulk?refresh=true"],
    ["PUT", "/jvb-works-v2"],
    ["DELETE", "/jvb-contacts-v1"],
    ["POST", "/jvb-works-v1/_refresh"],
    ["POST", "/jvb-contacts-v1/_forcemerge?only_expunge_deletes=true"],
    ["GET", "/jvb-contacts-v1/_count"],
    ["GET", "/jvb-contacts-v1/_mapping"],
    ["GET", "/_cluster/health"],
    ["GET", "/_cluster/settings?flat_settings=true"],
    ["GET", STATUS_LIST],
  ] as const) {
    assert.equal(edge(m, t, "jvb-search"), 401, `${m} ${t}`);
    assert.equal(edge(m, t, "none"), 401, `${m} ${t}`);
    assert.equal(edge(m, t, "wrong"), 401, `${m} ${t}`);
  }
  assert.equal(edge("POST", "/jvb-works-v1/_search", "none"), 401);
  assert.equal(edge("POST", "/jvb-works-v1/_search", "wrong"), 401);
});

// Each of these reached another index, or changed or exposed something, when
// sent straight to OpenSearch 3.9.0, or is a shape the studio does not send.
// None may reach the engine, with any login or none; the edge answers 400 or
// 404 itself, without asking for a password.
const REFUSED: [string, string, 400 | 404][] = [
  // other indices through the index position
  ["POST", "/jvb-works-v1,jvb-contacts-v1/_search", 404],
  ["POST", "/jvb-works-v1,*/_search", 404],
  ["POST", "/jvb-*/_search", 404],
  ["POST", "/jvb-*,-jvb-works-v1/_search", 404],
  ["POST", "/jvb-works-v1,.plugins-ml-config/_search", 404],
  ["POST", "/jvb-works-v1,top_queries-*/_search", 404],
  ["POST", "/jvb-works-v*/_search", 404],
  ["POST", "/_all/_search", 404],
  ["POST", "/*/_search", 404],
  ["POST", "/_search", 404],
  ["POST", "/jvb-works/_search", 404],
  ["POST", "/jvb-records-v1/_search", 404],
  ["POST", "/jvb-records/_search", 404],
  ["POST", "/jvb-works-v/_search", 404],
  ["POST", "/jvb-works-v1a/_search", 404],
  ["POST", "/jvb-works-v-1/_search", 404],
  ["POST", "/other-v1/_search", 404],
  ["POST", "/xjvb-works-v1/_search", 404],
  // encodings and spellings the engine reads differently from a proxy
  ["POST", "/jvb-works-v1%2Cjvb-contacts-v1/_search", 400],
  ["POST", "/jvb-works-v1%2c%2a/_search", 400],
  ["POST", "/%6Avb-works-v1/_search", 400],
  ["POST", "/jvb-works-v1/%5Fsearch", 400],
  ["POST", "//jvb-works-v1/_search", 400],
  ["POST", "/jvb-works-v1//_search", 400],
  ["POST", "/jvb-works-v1/./_search", 400],
  ["POST", "/jvb-works-v1/../_all/_search", 400],
  ["POST", "/_all/../jvb-works-v1/_search", 400],
  ["POST", "/jvb-works-v1/_search/.", 400],
  ["DELETE", "/jvb-works-v1/..", 400],
  ["GET", "/_cluster/health/.", 400],
  ["POST", "/jvb-works-v1/_search/", 404],
  ["POST", "/JVB-works-v1/_search", 404],
  ["POST", "/jvb-Works-v1/_search", 404],
  ["POST", "/jvb-works-v1/_SEARCH", 404],
  ["POST", "/jvb-works-V1/_search", 404],
  ["POST", "http://x/jvb-works-v1/_search", 400],
  ["POST", "*", 404],
  ["POST", "/jvb-works-v1/_search#x", 404],
  ["POST", "/jvb-works-v1/_search\n", 404],
  ["POST", "/jvb-works-v1/_search ", 404],
  // query strings on a search
  ["POST", "/jvb-works-v1/_search?scroll=5m", 404],
  ["POST", "/jvb-contacts-v1/_search?q=email:h*", 404],
  ["POST", "/jvb-works-v1/_search?index=jvb-contacts-v1", 404],
  ["POST", "/jvb-works-v1/_search?source=%7B%7D&source_content_type=application/json", 404],
  ["POST", "/jvb-works-v1/_search?expand_wildcards=all", 404],
  ["POST", "/jvb-works-v1/_search?search_pipeline=x", 404],
  ["POST", "/jvb-works-v1/_search?size=10000", 404],
  ["POST", "/jvb-works-v1/_search?", 404],
  // other methods on the search target
  ["GET", "/jvb-works-v1/_search", 404],
  ["HEAD", "/jvb-works-v1/_search", 404],
  ["OPTIONS", "/jvb-works-v1/_search", 404],
  ["PUT", "/jvb-works-v1/_search", 404],
  ["DELETE", "/jvb-works-v1/_search", 404],
  ["post", "/jvb-works-v1/_search", 404],
  // multi-target APIs whose bodies name indices
  ["POST", "/jvb-works-v1/_msearch", 404],
  ["POST", "/jvb-works-v1/_mget", 404],
  ["POST", "/_bulk", 404],
  ["POST", "/_msearch", 404],
  ["POST", "/_mget", 404],
  ["POST", "/jvb-works/_bulk", 404],
  ["POST", "/jvb-works-v1/_bulk?refresh=wait_for", 404],
  ["POST", "/jvb-works-v1/_bulk?refresh=true&pipeline=x", 404],
  ["POST", "/jvb-works-v1/_bulk?pipeline=x", 404],
  ["POST", "/jvb-works-v1/_bulk?require_alias=false&refresh=true", 404],
  ["POST", "/jvb-works-v1/_bulk?refresh", 404],
  ["POST", "/jvb-works-v1/_bulk?", 404],
  ["PUT", "/jvb-works-v1/_bulk", 404],
  ["POST", "/jvb-works-v1/_doc", 404],
  ["PUT", "/jvb-works-v1/_doc/abc", 404],
  ["POST", "/jvb-works-v1/_create/abc", 404],
  // scroll, point in time, templates, scripts, by-query writes
  ["POST", "/_search/scroll", 404],
  ["DELETE", "/_search/scroll/_all", 404],
  ["POST", "/jvb-works-v1/_search/point_in_time?keep_alive=1h", 404],
  ["POST", "/jvb-works-v1/_search/template", 404],
  ["POST", "/_scripts/x", 404],
  ["POST", "/jvb-works-v1/_update_by_query", 404],
  ["POST", "/jvb-works-v1/_delete_by_query", 404],
  ["POST", "/jvb-works-v1/_update/abc", 404],
  // reading documents and terms directly
  ["GET", "/jvb-contacts-v1/_doc/abc", 404],
  ["GET", "/jvb-contacts-v1/_source/abc", 404],
  ["GET", "/jvb-contacts-v1/_termvectors/abc", 404],
  ["POST", "/jvb-contacts-v1/_explain/abc", 404],
  ["POST", "/jvb-contacts-v1/_validate/query", 404],
  ["POST", "/jvb-contacts-v1/_field_caps", 404],
  ["POST", "/jvb-contacts-v1/_count", 404],
  ["GET", "/jvb-contacts-v1/_count?q=email:h*", 404],
  ["GET", "/jvb-*/_count", 404],
  ["GET", "/_all/_count", 404],
  ["GET", "/jvb-contacts-v1/_mapping/field/email", 404],
  ["GET", "/jvb-contacts-v1/_settings/index.blocks*", 404],
  ["GET", "/jvb-contacts-v1/_stats", 404],
  ["GET", "/jvb-contacts-v1/_segments", 404],
  ["GET", "/jvb-contacts-v1", 404],
  ["HEAD", "/jvb-contacts-v1", 404],
  // index administration beyond the exact versioned names
  ["DELETE", "/jvb-works", 404],
  ["DELETE", "/jvb-*", 404],
  ["DELETE", "/jvb-works-v*", 404],
  ["DELETE", "/jvb-works-v1,jvb-contacts-v1", 404],
  ["DELETE", "/_all", 404],
  ["DELETE", "/*", 404],
  ["DELETE", "/.plugins-ml-config", 404],
  ["DELETE", "/jvb-works-v1?ignore_unavailable=true", 404],
  ["PUT", "/jvb-works", 404],
  ["PUT", "/other-v1", 404],
  ["PUT", "/jvb-records-v1", 404],
  ["PUT", "/jvb-works-v1?wait_for_active_shards=all", 404],
  ["PUT", "/jvb-works-v1/_settings", 404],
  ["PUT", "/jvb-works-v1/_mapping", 404],
  ["POST", "/jvb-works-v1/_close", 404],
  ["POST", "/jvb-works-v1/_open", 404],
  ["POST", "/jvb-works-v1/_clone/anything", 404],
  ["POST", "/jvb-works-v1/_split/anything", 404],
  ["POST", "/jvb-works-v1/_shrink/anything", 404],
  ["POST", "/jvb-works-v1/_rollover", 404],
  ["PUT", "/jvb-contacts-v1/_alias/jvb-works", 404],
  ["POST", "/jvb-works-v1/_aliases", 404],
  ["GET", "/jvb-works-v1/_alias", 404],
  ["GET", "/jvb-*/_alias", 404],
  ["POST", "/jvb-works-v1/_forcemerge", 404],
  ["POST", "/jvb-works-v1/_forcemerge?max_num_segments=1", 404],
  ["POST", "/jvb-works-v1/_forcemerge?only_expunge_deletes=false", 404],
  ["POST", "/jvb-works-v1/_forcemerge?only_expunge_deletes=true&max_num_segments=1", 404],
  ["POST", "/_forcemerge?only_expunge_deletes=true", 404],
  ["POST", "/jvb-works-v1/_refresh?ignore_unavailable=true", 404],
  ["GET", "/jvb-works-v1/_refresh", 404],
  ["POST", "/_refresh", 404],
  ["POST", "/_aliases", 404],
  ["POST", "/_aliases?timeout=1d", 404],
  ["GET", "/_aliases", 404],
  ["PUT", "/_index_template/x", 404],
  ["PUT", "/_template/x", 404],
  // the cluster, the node, plugins
  ["GET", "/", 404],
  ["HEAD", "/", 404],
  ["GET", "/_cat/indices", 404],
  ["GET", "/_cat/indices?v", 404],
  ["GET", "/_cat/indices/jvb-*", 404],
  ["GET", "/_cat/indices/jvb-*?format=json", 404],
  ["GET", "/_cat/indices/*?format=json&h=index,health,docs.count,docs.deleted,store.size", 404],
  ["GET", `${STATUS_LIST}&s=index`, 404],
  ["GET", "/_cat/aliases/jvb-*", 404],
  ["GET", "/_cat/plugins", 404],
  ["GET", "/_cluster/health?level=indices", 404],
  ["GET", "/_cluster/health?wait_for_status=green&timeout=60s", 404],
  ["GET", "/_cluster/health/jvb-works-v1", 404],
  ["GET", "/_cluster/settings", 404],
  ["GET", "/_cluster/settings?include_defaults=true&flat_settings=true", 404],
  ["GET", "/_cluster/settings?flat_settings=true&include_defaults=true", 404],
  ["PUT", "/_cluster/settings", 404],
  ["PUT", "/_cluster/settings?flat_settings=true", 404],
  ["GET", "/_cluster/state", 404],
  ["POST", "/_cluster/reroute", 404],
  ["GET", "/_nodes", 404],
  ["GET", "/_nodes/stats", 404],
  ["GET", "/_nodes/stats/fs", 404],
  ["GET", "/_tasks", 404],
  ["POST", "/_reindex", 404],
  ["PUT", "/_snapshot/x", 404],
  ["GET", "/_snapshot", 404],
  ["PUT", "/_ingest/pipeline/x", 404],
  ["PUT", "/_search/pipeline/x", 404],
  ["POST", "/_plugins/_sql", 404],
  ["POST", "/_plugins/_ppl", 404],
  ["GET", "/_plugins/_ml/connectors", 404],
  ["GET", "/_insights/top_queries", 404],
  ["GET", "/top_queries-*/_search", 404],
  ["GET", "/health", 404],
  ["HEAD", "/health", 404],
  ["GET", "/_cluster/health ", 404],
  ["HEAD", "/_cluster/health", 404],
  ["POST", "/_cluster/health", 404],
];

test("everything else is answered at the edge, the same way with any login or none", () => {
  for (const [m, t, code] of REFUSED) {
    for (const login of LOGINS) assert.equal(edge(m, t, login), code, `${m} ${JSON.stringify(t)} as ${login} must get ${code} from the edge`);
  }
});

test("the engine holds the edge's line where Caddy cannot see: its settings in docker-compose.yml", () => {
  const compose = read("infra/compose/docker-compose.yml");
  const lines = compose.split("\n");
  const from = lines.indexOf("  opensearch:");
  assert.ok(from > 0, "docker-compose.yml has the opensearch service");
  let to = from + 1;
  while (to < lines.length && !/^(  [a-z]|[a-z])/.test(lines[to]!)) to++;
  const service = lines
    .slice(from + 1, to)
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");
  const value = (name: string) => new RegExp(`^\\s+${name.replaceAll(".", "\\.")}:\\s*"?([^"\\n]*)"?\\s*$`, "m").exec(service)?.[1]?.trim() ?? null;
  // A bulk or multi-search body may not name another index; jvb- names are
  // never made by a write; no wildcard deletes; no scripts.
  assert.equal(value("rest.action.multi.allow_explicit_index"), "false");
  assert.equal(value("action.auto_create_index"), "-jvb-*,+*");
  assert.equal(value("action.destructive_requires_name"), "true");
  assert.equal(value("script.allowed_types"), "none");
  assert.equal(value("http.max_content_length"), "20mb");
  assert.equal(value("discovery.type"), "single-node");
  assert.equal(value("cluster.default_number_of_replicas"), "0");
  assert.equal(value("DISABLE_SECURITY_PLUGIN"), "true");
  assert.equal(value("DISABLE_INSTALL_DEMO_CONFIG"), "true");
  assert.equal(value("cluster.routing.allocation.disk.watermark.low"), "4gb");
  assert.equal(value("cluster.routing.allocation.disk.watermark.high"), "3gb");
  assert.equal(value("cluster.routing.allocation.disk.watermark.flood_stage"), "2gb");
  // The plugin is not in the image: an unknown setting stops the node.
  assert.ok(!service.includes("search.insights"), "no search.insights.* settings");
  // Loopback only, on a network nothing else joins, no image name.
  assert.match(service, /^\s+ports:\n\s+- "127\.0\.0\.1:9200:9200"\n\s+environment:/m);
  assert.match(service, /^\s+networks:\n\s+- search\n/m);
  assert.equal(compose.match(/^\s+- search$/gm)?.length, 1, "only OpenSearch is on the search network");
  assert.match(service, /^\s+build:\n\s+context: \.\/opensearch$/m);
  assert.ok(!/^\s+image:/m.test(service), "built, not pulled");
  assert.equal(value("mem_limit"), value("memswap_limit"), "it never swaps");
  assert.equal(value("oom_score_adj"), "500");
  assert.match(service, /cap_drop:\n\s+- ALL/);
  assert.match(service, /security_opt:\n\s+- no-new-privileges:true/);
  assert.match(compose, /^volumes:\n(?:  .*\n)*  opensearch-data:$/m);
  assert.match(compose, /^networks:\n(?:  .*\n|    .*\n)*  search:\n    #.*\n    driver: bridge$/m);
  // The image: pinned by tag and digest, every plugin removed.
  const dockerfile = read("infra/compose/opensearch/Dockerfile");
  assert.match(dockerfile, /^FROM opensearchproject\/opensearch:3\.9\.0@sha256:[0-9a-f]{64}$/m);
  assert.match(dockerfile, /opensearch-plugin remove --purge/);
});

test("the logins, the runbook's substitutions and the example settings agree with the block", () => {
  const users = [...new Set(rules.flatMap((r) => r.users))].sort();
  assert.deepEqual(users, ["jvb-index", "jvb-search"]);
  const env = read("infra/compose/.env.example");
  assert.match(env, /^OPENSEARCH_SEARCH_USER=jvb-search$/m);
  assert.match(env, /^OPENSEARCH_INDEX_USER=jvb-index$/m);
  assert.ok(!/^[A-Z_]*(SEARCH|INDEX|OPENSEARCH)[A-Z_]*PASSWORD=/m.test(env), "no search password in .env.example: they live in the password manager and Vercel only");
  const runbook = read("docs/ops/opensearch-runbook.md");
  // Step 6 cuts the block out of the repository's Caddyfile from its title
  // line to the site's closing brace, and replaces the address and the two
  // placeholders. All of them must be there, once.
  assert.equal(caddyfile.split("\n").filter((l) => /^# OpenSearch, the studio.s search index/.test(l)).length, 1);
  assert.ok(runbook.includes("/^# OpenSearch, the studio.s search index/"), "the runbook finds the block by its title line");
  assert.ok(runbook.includes("/^search\\.example\\.com [{]$/"), "the runbook replaces the block's address");
  assert.equal(caddyfile.split("\n").filter((l) => l === `${SITE} {`).length, 1);
  for (const user of users) {
    assert.ok(runbook.includes(`[$]2a[$]10[$]CHANGE_ME_bcrypt_hash_for_${user}/`), `the runbook puts in ${user}'s hash`);
  }
  assert.ok(runbook.includes("hash-password --bcrypt-cost 10"));
  assert.ok(runbook.includes("infra/scripts/verify-search-edge.sh"));
});

test("every line of verify-search-edge.sh expects what the block does, and it reads only", () => {
  const path = "infra/scripts/verify-search-edge.sh";
  assert.ok(statSync(new URL(path, root)).mode & 0o100, `${path} is executable`);
  const script = read(path);
  const bodies = new Set(["", "$Q", "$NO_INDEX", "$NO_ALIASES", "$EMPTY", `'{"ids":[]}'`]);
  const checks = script
    .split("\n")
    .filter((l) => l.startsWith("check "))
    .map((l) => {
      const m = /^check (engine|[0-9]{3}) "([^"]+)" (none|wrong|search|index) (GET|POST|PUT|DELETE) '([^']+)'(?: "?(\$[A-Z_]+|'[^']*')"?)?$/.exec(l);
      assert.ok(m, `check line not in the expected form: ${l}`);
      assert.ok(bodies.has(m[6] ?? ""), `unknown body in: ${l}`);
      const login: Login = m[3] === "search" ? "jvb-search" : m[3] === "index" ? "jvb-index" : (m[3] as Login);
      return { want: m[1] === "engine" ? "engine" : Number(m[1]), label: m[2]!, login, method: m[4]!, target: m[5]! };
    });
  assert.ok(checks.length >= 60, "the script checks a long list");
  for (const c of checks) {
    assert.equal(edge(c.method, c.target, c.login), c.want, `verify-search-edge.sh "${c.label}": ${c.method} ${c.target} as ${c.login}`);
    // Nothing it sends can change anything, even through a wrong edge:
    // anything but a read names a v0 index (never made by the studio) or
    // nothing the engine would act on.
    const reads = c.method === "GET" || /\/(_search|_msearch|_mget|_count)\/?$/.test(c.target.split("?")[0]!);
    if (!reads) assert.ok(!/jvb-[a-z]+-v[1-9]/.test(c.target), `"${c.label}" writes to a real index name: ${c.target}`);
  }
  // Every allowed shape is tried with its login, and with the search login.
  for (const r of rules) {
    for (const cl of r.clauses) {
      const tried = checks.filter((c) => c.method === cl.method && cl.test(c.target));
      assert.ok(tried.some((c) => c.want === "engine"), `no check reaches the engine through ${cl.method} ${cl.source}`);
    }
  }
  for (const kind of KINDS) assert.ok(checks.some((c) => c.login === "jvb-search" && c.want === "engine" && c.target === `/jvb-${kind}-v1/_search`), `searches ${kind}`);
});

// The index names the studio's code builds (apps/studio/src/lib/opensearch/config.ts,
// pure, so node --test can load it) must be names the edge lets through.
const configUrl = new URL("apps/studio/src/lib/opensearch/config.ts", root);
test("the studio's index names fit the edge", { skip: !existsSync(configUrl) && "lib/opensearch/config.ts is not in this tree yet" }, async () => {
  const cfg = (await import(configUrl.href)) as {
    INDEX_PREFIX: string;
    INDEX_VERSION: Record<string, number>;
    indexName: (kind: string) => string;
  };
  assert.equal(cfg.INDEX_PREFIX, "jvb", "the Caddyfile names the jvb- prefix literally");
  assert.deepEqual(Object.keys(cfg.INDEX_VERSION).sort(), KINDS);
  for (const kind of KINDS) {
    const index = `/${cfg.indexName(kind)}`;
    assert.equal(who("POST", `${index}/_search`), "jvb-search,jvb-index", index);
    assert.equal(who("PUT", index), "jvb-index", index);
    assert.equal(who("POST", `${index}/_bulk?refresh=true`), "jvb-index", index);
  }
});
