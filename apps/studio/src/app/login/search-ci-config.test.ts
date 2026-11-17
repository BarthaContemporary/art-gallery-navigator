// node --test apps/studio/src/app/login/search-ci-config.test.ts
// CI's test job (.github/workflows/ci.yml) runs the search integration tests
// against an OpenSearch service container. These checks hold that container
// to the server's own (infra/compose/docker-compose.yml and
// infra/compose/opensearch/Dockerfile, which search-edge-config.test.ts holds
// to the edge): the same release and fingerprint, and the same engine
// settings, so the tests meet the server's behaviour rather than the
// defaults. Two differences are allowed and checked: auto-creation is also
// refused for the tests' own index names (or the drain's self-heal test
// skips), and Query Insights, a plugin only the stock image carries, is off.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../../../../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

// ------------------------------------------------- a small YAML subset reader

/**
 * Block mappings, block sequences, plain and quoted scalars, and `|` / `>`
 * block scalars: enough for the workflow and one compose service. A flow
 * value (`{ a: b }`, `["x", "y"]`) is kept as its text.
 */
type Yaml = string | Yaml[] | { [key: string]: Yaml };

type Line = { indent: number; text: string; raw: string };

/** The line without a trailing comment (a # after a space, outside quotes). */
function stripComment(raw: string): string {
  let quote: string | null = null;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]!;
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === "#" && (i === 0 || /\s/.test(raw[i - 1]!))) {
      return raw.slice(0, i);
    }
  }
  return raw;
}

function scalar(text: string): string {
  const t = text.trim();
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) return t.slice(1, -1);
  return t;
}

/** `key: rest` (rest may be empty), or null when the line is no mapping entry. */
function entry(text: string): { key: string; rest: string } | null {
  const m = /^("[^"]*"|'[^']*'|[^\s:'"][^:]*?)\s*:(?:\s+(.*))?$/.exec(text);
  return m ? { key: scalar(m[1]!), rest: (m[2] ?? "").trim() } : null;
}

function parseYaml(source: string): Yaml {
  const all: Line[] = source.split("\n").map((raw) => {
    const text = stripComment(raw).trimEnd();
    return { indent: raw.length - raw.trimStart().length, text: text.trim(), raw };
  });
  let i = 0;
  const skipBlank = () => {
    while (i < all.length && all[i]!.text === "") i++;
  };

  function blockScalar(parentIndent: number, style: string): string {
    const lines: string[] = [];
    while (i < all.length && (all[i]!.raw.trim() === "" || all[i]!.indent > parentIndent)) lines.push(all[i++]!.raw);
    while (lines.length && lines.at(-1)!.trim() === "") lines.pop();
    const cut = Math.min(...lines.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length));
    const body = lines.map((l) => l.slice(cut));
    return style.startsWith(">") ? body.map((l) => l.trim()).join(" ") : body.join("\n");
  }

  function value(rest: string, indent: number): Yaml {
    if (/^[|>][-+]?$/.test(rest)) return blockScalar(indent, rest);
    if (rest !== "") return scalar(rest);
    skipBlank();
    if (i < all.length && all[i]!.indent > indent) return block(all[i]!.indent);
    // A sequence may sit at its key's own indentation.
    if (i < all.length && all[i]!.indent === indent && all[i]!.text.startsWith("- ")) return block(indent);
    return "";
  }

  function block(indent: number): Yaml {
    skipBlank();
    const first = all[i]!;
    if (first.text === "-" || first.text.startsWith("- ")) {
      const items: Yaml[] = [];
      while (true) {
        skipBlank();
        if (i >= all.length || all[i]!.indent !== indent || !(all[i]!.text === "-" || all[i]!.text.startsWith("- "))) break;
        const line = all[i]!;
        const rest = line.text.slice(1).trim();
        const asEntry = entry(rest);
        if (asEntry && !rest.startsWith("{") && !rest.startsWith("[") && !rest.startsWith('"')) {
          // "- key: value" opens a mapping indented by the dash and its spaces.
          const spaces = line.text.length - 1 - line.text.slice(1).trimStart().length;
          const inner = indent + 1 + spaces;
          all[i] = { indent: inner, text: rest, raw: " ".repeat(inner) + rest };
          items.push(block(inner));
        } else {
          i++;
          items.push(value(rest, indent));
        }
      }
      return items;
    }
    const map: { [key: string]: Yaml } = {};
    while (true) {
      skipBlank();
      if (i >= all.length || all[i]!.indent !== indent || all[i]!.text.startsWith("- ")) break;
      const e = entry(all[i]!.text);
      assert.ok(e, `a mapping entry at line ${i + 1}: ${all[i]!.raw}`);
      i++;
      assert.ok(!(e.key in map), `key "${e.key}" appears once`);
      map[e.key] = value(e.rest, indent);
    }
    return map;
  }

  skipBlank();
  const doc = block(all[i]?.indent ?? 0);
  skipBlank();
  assert.equal(i, all.length, `the whole file was read (stopped at line ${i + 1})`);
  return doc;
}

const isMap = (y: Yaml | undefined): y is { [key: string]: Yaml } => typeof y === "object" && y !== null && !Array.isArray(y);
function get(y: Yaml | undefined, ...path: string[]): Yaml | undefined {
  let cur = y;
  for (const k of path) cur = isMap(cur) ? cur[k] : undefined;
  return cur;
}
const str = (y: Yaml | undefined) => (typeof y === "string" ? y : undefined);
const map = (y: Yaml | undefined, what: string) => {
  assert.ok(isMap(y), `${what} is a mapping`);
  return y;
};
const list = (y: Yaml | undefined, what: string) => {
  assert.ok(Array.isArray(y), `${what} is a list`);
  return y;
};

test("the YAML subset reader reads what the checks below rely on", () => {
  const doc = parseYaml(
    [
      "# a comment",
      "a:",
      "  b.c: single-node   # trailing comment",
      '  d: "-x-*,+*"',
      "  e: >-",
      "    one",
      "    two # kept",
      "  f:",
      "    - 1:2",
      "    - run: |",
      "        echo '#' x",
      "        echo y",
      "      env:",
      "        K: v",
      "  g: { x: 1 }",
      "h:",
      "- i",
    ].join("\n"),
  );
  assert.deepEqual(doc, {
    a: {
      "b.c": "single-node",
      d: "-x-*,+*",
      e: "one two # kept",
      f: ["1:2", { run: "echo '#' x\necho y", env: { K: "v" } }],
      g: "{ x: 1 }",
    },
    h: ["i"],
  });
});

// ---------------------------------------------------------------- the files

const workflow = parseYaml(read(".github/workflows/ci.yml"));
const jobs = map(get(workflow, "jobs"), "jobs");
const testJob = map(jobs.test, "the test job");
const service = map(get(testJob, "services", "opensearch"), "the opensearch service");
const ciEnv = map(service.env, "the service's env");

/** The compose file's opensearch service, read the way search-edge-config.test.ts finds it. */
function composeService() {
  const lines = read("infra/compose/docker-compose.yml").split("\n");
  const from = lines.indexOf("  opensearch:");
  assert.ok(from > 0, "docker-compose.yml has the opensearch service");
  let to = from + 1;
  while (to < lines.length && !/^(  [a-z]|[a-z])/.test(lines[to]!)) to++;
  return map(get(parseYaml(lines.slice(from, to).join("\n")), "opensearch"), "the compose service");
}
const compose = composeService();
const composeEnv = map(compose.environment, "the compose service's environment");

const steps = list(testJob.steps, "the test job's steps").map((s) => map(s, "a step"));
const stepRunning = (command: string) => {
  const found = steps.filter((s) => str(s.run)?.split("\n").some((l) => l.trim() === command));
  assert.equal(found.length, 1, `one step of the test job runs ${command}`);
  return found[0]!;
};

test("the service runs the server's release, fingerprint included", () => {
  const from = /^FROM (\S+)$/m.exec(read("infra/compose/opensearch/Dockerfile"))?.[1];
  assert.match(from ?? "", /^opensearchproject\/opensearch:\d+\.\d+\.\d+@sha256:[0-9a-f]{64}$/);
  assert.equal(str(service.image), from);
  assert.equal(str(testJob["runs-on"]), "ubuntu-24.04", "a pinned runner image (its PostgreSQL 16 runs the database tests)");
});

test("the service has the server's engine settings, with the two allowed differences", () => {
  // Names and placement differ by design (one node in CI, its own name on
  // the server); the heap differs in size only.
  const notCompared = new Set(["cluster.name", "node.name", "OPENSEARCH_JAVA_OPTS"]);
  for (const [name, value] of Object.entries(composeEnv)) {
    if (notCompared.has(name)) continue;
    assert.equal(typeof value, "string", `compose ${name} is a plain value`);
    if (name === "action.auto_create_index") {
      // The server's list, with the tests' own prefix refused before the final "+*".
      const server = (value as string).split(",");
      assert.equal(server.at(-1), "+*");
      assert.deepEqual(str(ciEnv[name])?.split(","), [...server.slice(0, -1), "-oslib-*", "+*"], name);
      continue;
    }
    assert.equal(str(ciEnv[name]), value, `CI sets ${name} as the server does`);
  }
  // Nothing else, apart from switching off the plugin the server's image lacks.
  const extra = Object.keys(ciEnv).filter((k) => !(k in composeEnv)).sort();
  assert.deepEqual(extra, [
    "search.insights.top_queries.cpu.enabled",
    "search.insights.top_queries.latency.enabled",
    "search.insights.top_queries.memory.enabled",
  ]);
  for (const k of extra) assert.equal(str(ciEnv[k]), "false", k);
  // A small fixed heap (minimum = maximum), as on the server.
  assert.match(str(ciEnv.OPENSEARCH_JAVA_OPTS) ?? "", /^-Xms(\d+[mg]) -Xmx\1$/);
  assert.match(str(composeEnv.OPENSEARCH_JAVA_OPTS) ?? "", /^"?-Xms\$\{OPENSEARCH_HEAP:-512m\} -Xmx\$\{OPENSEARCH_HEAP:-512m\}/);
});

test("the tests' index names are the ones CI refuses to auto-create", () => {
  const support = read("apps/studio/src/lib/opensearch/test-support.mjs");
  assert.match(support, /export function testPrefix\(tag\) \{\n\s+return `oslib-\$\{tag\}-/);
  assert.match(support, /prefix\.startsWith\("oslib-"\)/, "dropIndices deletes only the tests' own indices");
});

test("the service answers where the tests look, and is checked before they run", () => {
  assert.deepEqual(list(service.ports, "ports"), ["9200:9200"]);
  const options = str(service.options) ?? "";
  assert.match(options, /--health-cmd "curl -fsS -o \/dev\/null 'http:\/\/127\.0\.0\.1:9200\/_cluster\/health\?wait_for_status=yellow&timeout=5s'"/);
  const unit = stepRunning("pnpm test:unit");
  assert.equal(str(get(unit, "env", "OPENSEARCH_TEST_URL")), "http://127.0.0.1:9200");
  // The settings check comes first and names the refusal CI sets.
  const check = steps.findIndex((s) => str(s.run)?.includes("/_nodes/_local/settings"));
  assert.ok(check >= 0 && check < steps.indexOf(unit), "the settings check runs before the tests");
  const checkRun = str(steps[check]!.run)!;
  for (const name of ["action.auto_create_index", "rest.action.multi.allow_explicit_index", "action.destructive_requires_name", "discovery.type"]) {
    assert.ok(checkRun.includes(`."${name}" == "${str(ciEnv[name])}"`), `the check reads ${name} as set`);
  }
});

test("the database tests run with the PostgreSQL the harness expects", () => {
  const db = stepRunning("pnpm test:db");
  const bin = str(get(db, "env", "PG_BIN"));
  assert.equal(bin, "/usr/lib/postgresql/16/bin");
  assert.match(read("scripts/db-harness/run.sh"), /^BIN="\$\{PG_BIN:-\/usr\/lib\/postgresql\/16\/bin\}"$/m);
});

test("the unit tests run once, in the test job", () => {
  let runs = 0;
  for (const [name, job] of Object.entries(jobs)) {
    for (const s of list(get(job, "steps"), `${name}'s steps`)) {
      if (str(get(s, "run"))?.split("\n").some((l) => l.trim() === "pnpm test:unit")) {
        runs++;
        assert.equal(name, "test");
      }
    }
  }
  assert.equal(runs, 1);
  // The other jobs are still there.
  assert.deepEqual(Object.keys(jobs).sort(), ["audit", "build", "test", "worker-lockfile"]);
});
