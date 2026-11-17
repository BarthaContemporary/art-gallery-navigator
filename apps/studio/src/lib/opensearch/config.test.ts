// node --test apps/studio/src/lib/opensearch/config.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the explicit extension; the studio's tsconfig does not allow it.
// @ts-ignore TS5097
import { INDEX_PREFIX, INDEX_VERSION, SEARCH_KINDS, indexName, searchConfig, searchConfigProblem, testSearchConfig } from "./config.ts";

const full = {
  OPENSEARCH_URL: "https://search.example.com/",
  OPENSEARCH_SEARCH_USER: "jvb-search",
  OPENSEARCH_SEARCH_PASSWORD: "s3cret-search",
  OPENSEARCH_INDEX_USER: "jvb-index",
  OPENSEARCH_INDEX_PASSWORD: "s3cret-index",
};

test("no URL is 'not configured', and not a problem", () => {
  assert.equal(searchConfig({}), null);
  assert.equal(searchConfig({ OPENSEARCH_URL: "   " }), null);
  assert.equal(searchConfigProblem({}), null);
});

test("a complete https configuration: origin only, two accounts, versioned jvb names", () => {
  const cfg = searchConfig(full);
  assert.ok(cfg);
  assert.equal(cfg.url, "https://search.example.com");
  assert.deepEqual(cfg.search, { user: "jvb-search", password: "s3cret-search" });
  assert.deepEqual(cfg.index, { user: "jvb-index", password: "s3cret-index" });
  assert.equal(cfg.prefix, "jvb");
  assert.deepEqual(cfg.indices, { works: "jvb-works-v1", makers: "jvb-makers-v1", contacts: "jvb-contacts-v1" });
  assert.equal(searchConfigProblem(full), null);
});

test("the prefix is the constant jvb: no variable can change it", () => {
  const cfg = searchConfig({ ...full, OPENSEARCH_INDEX_PREFIX: "other" });
  assert.equal(cfg?.prefix, "jvb");
  assert.equal(INDEX_PREFIX, "jvb");
});

test("http only on loopback; a URL with credentials, a path or a query is refused", () => {
  for (const url of ["http://search.example.com", "http://10.0.0.5:9200", "ftp://search.example.com"]) {
    assert.equal(searchConfig({ ...full, OPENSEARCH_URL: url }), null, url);
    assert.match(searchConfigProblem({ ...full, OPENSEARCH_URL: url }) ?? "", /https/);
  }
  assert.equal(searchConfig({ ...full, OPENSEARCH_URL: "https://jvb-search:pw@search.example.com" }), null);
  assert.match(searchConfigProblem({ ...full, OPENSEARCH_URL: "https://u:p@search.example.com" }) ?? "", /user name or password/);
  for (const url of ["https://search.example.com/search", "https://search.example.com/?x=1", "https://search.example.com/#a", "not a url"]) {
    assert.equal(searchConfig({ ...full, OPENSEARCH_URL: url }), null, url);
    assert.ok(searchConfigProblem({ ...full, OPENSEARCH_URL: url }), url);
  }
  for (const url of ["http://127.0.0.1:9200", "http://localhost:9200", "http://[::1]:9200"]) {
    assert.ok(searchConfig({ OPENSEARCH_URL: url }), url); // a local node with security off needs no accounts
  }
});

test("both accounts must be complete away from loopback, and never carry a colon", () => {
  for (const missing of ["OPENSEARCH_SEARCH_USER", "OPENSEARCH_SEARCH_PASSWORD", "OPENSEARCH_INDEX_USER", "OPENSEARCH_INDEX_PASSWORD"]) {
    const env = { ...full, [missing]: "" };
    assert.equal(searchConfig(env), null, missing);
    assert.ok(searchConfigProblem(env), missing);
  }
  assert.equal(searchConfig({ ...full, OPENSEARCH_SEARCH_USER: "a:b" }), null);
  // A half account on loopback is still refused.
  assert.equal(searchConfig({ OPENSEARCH_URL: "http://127.0.0.1:9200", OPENSEARCH_INDEX_USER: "x" }), null);
});

test("a problem never repeats a password", () => {
  const envs = [
    { ...full, OPENSEARCH_URL: "http://search.example.com" },
    { ...full, OPENSEARCH_INDEX_USER: "" },
    { ...full, OPENSEARCH_URL: "https://jvb:s3cret-search@search.example.com" },
  ];
  for (const env of envs) {
    const p = searchConfigProblem(env) ?? "";
    assert.ok(p.length > 0);
    assert.ok(!p.includes("s3cret"), p);
  }
});

test("index names: jvb-<kind>-v<N>, checked prefix and version", () => {
  for (const kind of SEARCH_KINDS) assert.equal(indexName(kind), `jvb-${kind}-v${INDEX_VERSION[kind]}`);
  assert.equal(indexName("works", "ostest-a1", 3), "ostest-a1-works-v3");
  for (const bad of ["", "JVB", "jvb,*", "../x", "_all", "jvb-*", "a b"]) assert.throws(() => indexName("works", bad), bad);
  assert.throws(() => indexName("works", "jvb", 0));
  assert.throws(() => indexName("works", "jvb", 1.5));
});

test("tests get their own prefix, never jvb", () => {
  const cfg = testSearchConfig("http://127.0.0.1:9209/", "ostest-x");
  assert.equal(cfg.url, "http://127.0.0.1:9209");
  assert.deepEqual(cfg.indices, { works: "ostest-x-works-v1", makers: "ostest-x-makers-v1", contacts: "ostest-x-contacts-v1" });
  assert.throws(() => testSearchConfig("http://127.0.0.1:9209", "jvb"));
});
