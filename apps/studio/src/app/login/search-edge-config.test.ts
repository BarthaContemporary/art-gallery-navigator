// node --test apps/studio/src/app/login/search-edge-config.test.ts
// The studio's search engine (OpenSearch) has no password of its own: the
// search site in infra/compose/Caddyfile is its whole gate. These checks read
// that block, turn it into rules (which login may send which method to which
// request target) and run a long list of requests that must and must not get
// through, as auth-server-config.test.ts does for the API snippet. Every
// request the model runs also checks that Caddy is never made to check a
// password against its built-in cost-14 hash (almost 1 s of processor time
// each), which it does for a login name a basic_auth block does not list:
// the block's two login checks must turn those away first. They also
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
// The two checks on the login that come before any shape, word for word.
// Caddy checks a password even for a login its basic_auth block does not
// list, against a built-in cost-14 hash (almost 1 s of processor time), so
// these refuse such requests first; the tests below work the patterns out
// from the login names and check that no request can reach that hash.
const UNKNOWN_LOGIN =
  'expression `{http.request.header.Authorization} != "" && !{http.request.header.Authorization}.matches("^Basic (anZiLXNlYXJjaD[o-r]|anZiLWluZGV4O[g-v])")`';
const SEARCH_LOGIN_NOT_SEARCH =
  "expression `{http.request.header.Authorization}.matches(\"^Basic anZiLXNlYXJjaD[o-r]\") && !(method('POST') && {http.request.orig_uri}.matches(\"^/jvb-(works|makers|contacts)-v[0-9]+/_search$\"))`";
const PRE_CHECKS = ["search_unknown_login", "search_login_not_search"];

type Clause = { method: string; source: string; test: (target: string) => boolean };
type Rule = { matcher: string; clauses: Clause[]; users: string[]; maxSize: string };
// Who the request says it is: no Authorization header; a known name with a
// wrong password; a name that is not one of the two; a name whose base64
// begins like jvb-index's ("jvb-index9"); and the two logins themselves.
type Login = "none" | "wrong-search" | "wrong-index" | "unknown" | "lookalike" | "jvb-search" | "jvb-index";
// "login": Caddy's basic_auth answered 401 (with a password prompt); 401:
// the edge refused at once, before any password check.
type Outcome = "engine" | "login" | 400 | 401 | 404;

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

/** A header pattern from one of the two login checks: anchored at the start, no escapes. */
function headerPattern(source: string): RegExp {
  assert.ok(source.startsWith("^Basic "), `login pattern not anchored on "Basic ": ${source}`);
  assert.ok(!source.includes("\\"), `login pattern uses a backslash: ${source}`);
  return new RegExp(source);
}

/** The block's matchers, handles and the rules they make, read from the file. */
function loadRules() {
  assert.ok(site, `Caddyfile has the ${SITE} site`);
  const body = site.children!;
  const matchers = new Map<string, Clause[]>();
  let noncanonical: string | null = null;
  const pre = new Map<string, string>();
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
        if (PRE_CHECKS.includes(name)) {
          pre.set(name, named[2]);
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
      if (PRE_CHECKS.includes(name)) {
        assert.ok(pre.has(name), `handle @${name} has a matcher defined before it`);
        // Refused at once: no password prompt, no password check, nothing sent on.
        assert.deepEqual(kids(n), ['respond "Unauthorized" 401'], `handle @${name} answers 401 itself`);
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
  assert.deepEqual(order.slice(1, 3), PRE_CHECKS, "then the two login checks, before any shape and so before any password check");
  assert.equal(noncanonical, NONCANONICAL, "the plain-form check is the house pattern, run on the target as sent");
  assert.equal(pre.get("search_unknown_login"), UNKNOWN_LOGIN, "the unknown-login check, word for word");
  assert.equal(pre.get("search_login_not_search"), SEARCH_LOGIN_NOT_SEARCH, "the search login's check, word for word");

  // What the two checks do, read from their text.
  const u = /^expression `\{http\.request\.header\.Authorization\} != "" && !\{http\.request\.header\.Authorization\}\.matches\("([^"]+)"\)`$/.exec(UNKNOWN_LOGIN)!;
  const s = /^expression `\{http\.request\.header\.Authorization\}\.matches\("([^"]+)"\) && !\((method\('[A-Z]+'\) && \{http\.request\.orig_uri\}\.matches\("[^"]+"\))\)`$/.exec(SEARCH_LOGIN_NOT_SEARCH)!;
  const known = headerPattern(u[1]!);
  const searchLogin = headerPattern(s[1]!);
  const searchShape = parseClause(s[2]!, null);
  return {
    rules,
    noncanonical: new RegExp(noncanonical!),
    knownLoginSource: u[1]!,
    searchLoginSource: s[1]!,
    searchShape,
    unknownLogin: (header: string) => header !== "" && !known.test(header),
    searchLoginNotSearch: (method: string, target: string, header: string) =>
      searchLogin.test(header) && !(method === searchShape.method && searchShape.test(target)),
  };
}

const model = loadRules();
const { rules, noncanonical } = model;

const basic = (userPass: string | Uint8Array) => `Basic ${Buffer.from(userPass).toString("base64")}`;
// The right passwords, in this model (48 characters, as the runbook makes them).
const PASSWORDS: Record<string, string> = { "jvb-search": "s".repeat(48), "jvb-index": "i".repeat(48) };
const HEADERS: Record<Login, string> = {
  none: "",
  "wrong-search": basic("jvb-search:not-the-password"),
  "wrong-index": basic("jvb-index:not-the-password"),
  unknown: basic("jvb-nobody:not-the-password"),
  lookalike: basic("jvb-index9:not-the-password"),
  "jvb-search": basic(`jvb-search:${PASSWORDS["jvb-search"]}`),
  "jvb-index": basic(`jvb-index:${PASSWORDS["jvb-index"]}`),
};

/**
 * The login name Caddy's basic_auth reads from an Authorization header, as
 * Go's Request.BasicAuth does: "Basic " in any letter case, standard base64
 * with its padding, then everything before the first colon. null when Go
 * cannot read a login there (Caddy then prompts without checking anything).
 */
function basicUser(header: string): string | null {
  if (!/^basic /i.test(header)) return null;
  const b64 = header.slice("Basic ".length);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(b64)) return null;
  const text = Buffer.from(b64, "base64").toString("latin1");
  const colon = text.indexOf(":");
  return colon < 0 ? null : text.slice(0, colon);
}

/** What the search site does with a request carrying this Authorization header ("" for none). */
function edgeFor(method: string, target: string, header: string): Outcome {
  if (noncanonical.test(target)) return 400;
  if (model.unknownLogin(header)) return 401;
  if (model.searchLoginNotSearch(method, target, header)) return 401;
  const hits = rules.filter((r) => r.clauses.some((c) => c.method === method && c.test(target)));
  assert.ok(hits.length <= 1, `${method} ${target} matches more than one handle: ${hits.map((h) => h.matcher).join(", ")}`);
  if (hits.length === 0) return 404;
  const rule = hits[0]!;
  const name = basicUser(header);
  // No login Go can read: basic_auth prompts, and checks nothing.
  if (name === null) return "login";
  // basic_auth checks the password of a name it does not list against
  // Caddy's built-in cost-14 hash; the two login checks must keep every such
  // request away from it.
  assert.ok(rule.users.includes(name), `${method} ${target} as ${JSON.stringify(name)} would be checked against Caddy's built-in slow hash (@${rule.matcher})`);
  return header === basic(`${name}:${PASSWORDS[name]}`) ? "engine" : "login";
}
const edge = (method: string, target: string, login: Login): Outcome => edgeFor(method, target, HEADERS[login]);
const LOGINS: Login[] = ["none", "wrong-search", "wrong-index", "unknown", "lookalike", "jvb-search", "jvb-index"];
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

test("what the studio and verify-search-edge.sh send gets through, to the right login only", () => {
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
        ["GET", `${index}/_count`], // verify-search-edge.sh only; the studio reads _cat/indices
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
    // The search login, right password or wrong, is refused before any
    // password check (basic_auth here lists jvb-index only).
    assert.equal(edge(m, t, "jvb-search"), 401, `${m} ${t}`);
    assert.equal(edge(m, t, "wrong-search"), 401, `${m} ${t}`);
    // No login: the password prompt; the index name with a wrong password:
    // one check against its cost-10 hash, then the prompt.
    assert.equal(edge(m, t, "none"), "login", `${m} ${t}`);
    assert.equal(edge(m, t, "wrong-index"), "login", `${m} ${t}`);
    assert.equal(edge(m, t, "unknown"), 401, `${m} ${t}`);
    assert.equal(edge(m, t, "lookalike"), 401, `${m} ${t}`);
  }
  for (const login of ["none", "wrong-search", "wrong-index"] as const) assert.equal(edge("POST", "/jvb-works-v1/_search", login), "login", login);
  for (const login of ["unknown", "lookalike"] as const) assert.equal(edge("POST", "/jvb-works-v1/_search", login), 401, login);
});

// The base64 alphabet, in order.
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * How the base64 of any text that begins with `prefix` begins: the whole
 * characters, then a bracketed class for the last character the prefix only
 * partly fixes. For "jvb-index:" that is "anZiLWluZGV4O[g-v]".
 */
function base64Beginning(prefix: string): string {
  const bytes = Buffer.from(prefix, "utf8");
  const whole = bytes.length - (bytes.length % 3);
  let out = Buffer.from(bytes.subarray(0, whole)).toString("base64");
  const rest = bytes.subarray(whole);
  if (rest.length === 0) return out;
  const x = rest[0]!;
  out += B64[x >> 2];
  let from: number;
  let count: number;
  if (rest.length === 1) {
    from = (x & 3) << 4;
    count = 16;
  } else {
    const y = rest[1]!;
    out += B64[((x & 3) << 4) | (y >> 4)];
    from = (y & 15) << 2;
    count = 4;
  }
  const chars = B64.slice(from, from + count);
  // One range when the characters run on in ASCII, as they do for the two names.
  const runs = chars.charCodeAt(chars.length - 1) - chars.charCodeAt(0) === chars.length - 1;
  return out + (runs ? `[${chars[0]}-${chars.at(-1)}]` : `[${chars}]`);
}

/** A small, fixed pseudo-random sequence (mulberry32), so the test is the same every run. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Authorization headers an outsider might send: near misses of both names at every byte, odd schemes, random bytes. */
function hostileHeaders(users: string[]): string[] {
  const out: string[] = ["Basic", "Basic ", "Basic  " + HEADERS["jvb-search"].slice(6), "basic " + HEADERS["jvb-index"].slice(6)];
  out.push("BASIC " + HEADERS["jvb-search"].slice(6), "Bearer x", "Digest username=\"jvb-index\"", " " + HEADERS["jvb-index"]);
  out.push(",Basic " + basic("jvb-nobody:x"), basic("jvb-nobody:x") + "," + HEADERS["jvb-index"], HEADERS["jvb-index"] + "," + basic("jvb-nobody:x"));
  for (const user of users) {
    const name = Buffer.from(user, "latin1");
    out.push(basic(user), basic(`${user}:`), basic(`${user}::`), basic(`${user}:${"x".repeat(200)}`), basic(user.toUpperCase() + ":x"));
    out.push(basic(user.slice(0, -1) + ":x"), basic(`${user}${user}:x`), basic(`x${user}:x`));
    for (let i = 0; i <= name.length; i++) {
      for (let b = 0; b < 256; b++) {
        // Byte i changed (or, at the end, one byte added), then a password.
        const bytes = Buffer.concat([name.subarray(0, i), Buffer.from([b]), name.subarray(i < name.length ? i + 1 : i), Buffer.from(":pw")]);
        out.push(basic(bytes));
        // The same, cut short at every length, so the last base64 group varies too.
        if (b % 17 === 0) for (let n = 1; n < bytes.length; n++) out.push(basic(bytes.subarray(0, n)));
      }
    }
  }
  const next = random(20261116);
  for (let k = 0; k < 20000; k++) {
    const len = Math.floor(next() * 24);
    const bytes = Buffer.alloc(len);
    for (let j = 0; j < len; j++) bytes[j] = Math.floor(next() * 256);
    // Mostly random bytes; some start with a name and end anywhere.
    if (k % 4 === 0) out.push(basic(Buffer.concat([Buffer.from(users[k % users.length]!, "latin1"), bytes])));
    else out.push(basic(bytes));
  }
  return out;
}

test("a login that is neither of the two is refused before any password check, worked out from the names", () => {
  // The names the basic_auth blocks list, in the order the pattern names them.
  const users = [...new Set(rules.flatMap((r) => r.users))].sort().reverse();
  assert.deepEqual(users, ["jvb-search", "jvb-index"]);
  assert.equal(model.knownLoginSource, `^Basic (${users.map((u) => base64Beginning(`${u}:`)).join("|")})`, "the pattern is how base64 of each login and its colon begins");
  assert.equal(base64Beginning("jvb-search:"), "anZiLXNlYXJjaD[o-r]");
  assert.equal(base64Beginning("jvb-index:"), "anZiLWluZGV4O[g-v]");
  // The pattern lets through exactly the headers whose login, as Go reads it,
  // is one of the two (or that Go cannot read as a login at all, which Caddy
  // answers with its prompt without checking anything).
  const passed = new Map<string | null, number>();
  for (const header of hostileHeaders(users)) {
    const name = basicUser(header);
    if (!model.unknownLogin(header)) {
      passed.set(name, (passed.get(name) ?? 0) + 1);
      assert.ok(name === null || users.includes(name), `${JSON.stringify(header)} (login ${JSON.stringify(name)}) gets past the unknown-login check`);
    } else if (/^Basic /.test(header)) {
      assert.ok(name === null || !users.includes(name), `${JSON.stringify(header)} (login ${JSON.stringify(name)}) is refused although it is one of the two`);
    }
  }
  for (const user of users) assert.ok((passed.get(user) ?? 0) >= 10, `the near misses include ${user} itself`);
  // The studio's own headers (lib/opensearch/client.ts: "Basic " + base64 of
  // user:password) pass, with any password.
  const next = random(7);
  for (const user of users) {
    for (let k = 0; k < 500; k++) {
      const password = Array.from({ length: 1 + Math.floor(next() * 64) }, () => String.fromCharCode(32 + Math.floor(next() * 95))).join("");
      assert.equal(model.unknownLogin(basic(`${user}:${password}`)), false, `${user} with a password of ${password.length} characters`);
    }
  }
  assert.equal(model.unknownLogin(""), false, "no login at all goes on to the prompt");
});

test("the search login is refused at once wherever basic_auth does not list it", () => {
  assert.equal(model.searchLoginSource, `^Basic ${base64Beginning("jvb-search:")}`);
  // Every login is listed by every handle, except jvb-search, which only the
  // search shape lists; the check's exception is exactly that shape.
  const users = [...new Set(rules.flatMap((r) => r.users))];
  for (const user of users) {
    const listedBy = rules.filter((r) => r.users.includes(user));
    if (listedBy.length === rules.length) continue;
    assert.equal(user, "jvb-search", `${user} is not listed everywhere and has no check of its own`);
    const shapes = listedBy.flatMap((r) => r.clauses.map((c) => `${c.method} ${c.source}`));
    assert.deepEqual(shapes, [`${model.searchShape.method} ${model.searchShape.source}`], "the search login's check spares exactly the shapes that list it");
  }
});

// Each of these reached another index, or changed or exposed something, when
// sent straight to OpenSearch 3.9.0, or is a shape the studio does not send.
// None may reach the engine, with any login or none; the edge answers itself:
// 400 or 404 as listed with no login or the index name, and 401 at once
// (before any password check) to the search login and to names that are not
// one of the two, unless the target is not in its plain form (400).
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

test("everything else is answered at the edge, without a password check for any login but the right one", () => {
  for (const [m, t, code] of REFUSED) {
    for (const login of ["none", "wrong-index", "jvb-index"] as const) assert.equal(edge(m, t, login), code, `${m} ${JSON.stringify(t)} as ${login} must get ${code} from the edge`);
    const early = code === 400 ? 400 : 401;
    for (const login of ["jvb-search", "wrong-search", "unknown", "lookalike"] as const) assert.equal(edge(m, t, login), early, `${m} ${JSON.stringify(t)} as ${login} must get ${early} from the edge`);
  }
});

test("no request, whatever its login, reaches a password check against Caddy's built-in slow hash", () => {
  // edgeFor() fails the moment basic_auth would be handed a login name it
  // does not list. Run every shape the studio sends, and every refused one,
  // with every kind of login and with a long list of made-up ones.
  const users = [...new Set(rules.flatMap((r) => r.users))];
  const hostile = hostileHeaders(users);
  const sent: [string, string][] = [];
  for (const kind of KINDS) {
    const index = `/jvb-${kind}-v1`;
    sent.push(["POST", `${index}/_search`], ["POST", `${index}/_bulk?refresh=true`], ["PUT", index], ["DELETE", index], ["GET", `${index}/_count`]);
  }
  sent.push(["POST", "/jvb-works-v1/_bulk"], ["POST", "/jvb-works-v1/_refresh"], ["POST", "/jvb-contacts-v1/_forcemerge?only_expunge_deletes=true"]);
  sent.push(["GET", "/jvb-works-v1/_mapping"], ["GET", "/jvb-works-v1/_settings"], ["GET", "/_cluster/health"], ["GET", "/_cluster/settings?flat_settings=true"], ["GET", STATUS_LIST]);
  // Every clause of every handle is among them.
  for (const r of rules) for (const c of r.clauses) assert.ok(sent.some(([m, t]) => m === c.method && c.test(t)), `${c.method} ${c.source} is swept`);
  let reachedEngine = 0;
  for (const [m, t] of sent) {
    for (const header of hostile) if (edgeFor(m, t, header) === "engine") reachedEngine++;
  }
  assert.equal(reachedEngine, 0, "no made-up login gets in");
  for (const [m, t] of REFUSED) for (let k = 0; k < hostile.length; k += 97) edgeFor(m, t, hostile[k]!);
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
      const m = /^check (engine|login|[0-9]{3}) "([^"]+)" (none|wrong-search|wrong-index|unknown|lookalike|search|index) (GET|POST|PUT|DELETE) '([^']+)'(?: "?(\$[A-Z_]+|'[^']*')"?)?$/.exec(l);
      assert.ok(m, `check line not in the expected form: ${l}`);
      assert.ok(bodies.has(m[6] ?? ""), `unknown body in: ${l}`);
      const login: Login = m[3] === "search" ? "jvb-search" : m[3] === "index" ? "jvb-index" : (m[3] as Login);
      const want: Outcome = m[1] === "engine" || m[1] === "login" ? m[1] : (Number(m[1]) as 400 | 401 | 404);
      return { want, label: m[2]!, login, method: m[4]!, target: m[5]! };
    });
  assert.ok(checks.length >= 60, "the script checks a long list");
  // The script's logins are the model's: the same names, the right
  // passwords only for the two logins.
  const arms = script.split("\n").filter((l) => /^\s+[a-z-]+\) /.test(l)).map((l) => l.trim());
  for (const arm of [
    "none) ;;",
    'wrong-search) auth="user = \\"$SEARCH_USER:not-the-password\\"" ;;',
    'wrong-index) auth="user = \\"$INDEX_USER:not-the-password\\"" ;;',
    'unknown) auth="user = \\"jvb-nobody:not-the-password\\"" ;;',
    'lookalike) auth="user = \\"jvb-index9:not-the-password\\"" ;;',
    'search) auth="user = \\"$SEARCH_USER:$SEARCH_PW\\"" ;;',
    'index) auth="user = \\"$INDEX_USER:$INDEX_PW\\"" ;;',
  ]) {
    assert.ok(arms.includes(arm), `verify-search-edge.sh has the login ${arm}`);
  }
  assert.equal(HEADERS.unknown, basic("jvb-nobody:not-the-password"));
  assert.equal(HEADERS.lookalike, basic("jvb-index9:not-the-password"));
  // It tells Caddy's password check (it sends a WWW-Authenticate prompt)
  // from the edge's own early 401, and from OpenSearch.
  assert.ok(script.includes(`elif [ "$code" = 401 ] && grep -qi '^www-authenticate:' "$HDR"; then who=login`), "the script recognises basic_auth's answer");
  // Every login kind is tried, and the early 401 for each made-up one.
  for (const login of LOGINS) assert.ok(checks.some((c) => c.login === login), `the script tries ${login}`);
  for (const login of ["unknown", "lookalike", "wrong-search"] as const) {
    assert.ok(checks.some((c) => c.login === login && c.want === 401 && rules.some((r) => r.clauses.some((cl) => cl.method === c.method && cl.test(c.target)))), `the script shows ${login} refused before the password check on a listed shape`);
  }
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
