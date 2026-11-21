// node --test "apps/studio/src/app/(app)/admin/search-words.test.ts"
// Admin → Search in words: every engine state, the queue, the stored run
// results, the index counts and the "Reconcile now" notice.
import { test, before } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore TS5097
import "../../../lib/test-support/alias.ts";

type Words = typeof import("./search-words");
let w: Words;
before(async () => {
  // @ts-ignore TS5097
  w = (await import("./search-words.ts")) as Words;
});

type Index = Parameters<Words["indexWords"]>[0];
const index = (over: Partial<Index> = {}): Index => ({
  kind: "works",
  name: "jvb-works-v1",
  exists: true,
  health: "green",
  documents: 1234,
  deletedDocuments: 0,
  size: "1mb",
  readOnly: false,
  database: 1234,
  ...over,
});

test("not configured says, in these words, that search uses Postgres only", () => {
  const e = w.engineWords({ engine: "not configured", health: null, problem: null });
  assert.equal(e.summary, "Search uses Postgres only (OpenSearch not configured).");
  assert.equal(e.tone, "info");
  assert.equal(e.label, "Not configured");
  assert.equal(e.detail, null);
});

test("every engine state has a plain sentence; the problem states say what to do", () => {
  const states = ["misconfigured", "unreachable", "disk-full", "read-only"] as const;
  for (const engine of states) {
    const e = w.engineWords({ engine, health: null, problem: engine === "misconfigured" ? "OPENSEARCH_URL must use https" : null });
    assert.equal(e.tone, "warn", engine);
    assert.ok(e.label && e.label !== "OK", engine);
    assert.ok(e.summary.length > 20 && e.summary.endsWith("."), engine);
    assert.match(e.detail ?? "", /runbook/, engine);
  }
  assert.match(w.engineWords({ engine: "misconfigured", health: null, problem: "OPENSEARCH_URL must use https" }).detail ?? "", /^OPENSEARCH_URL must use https\. Check/);
  assert.match(w.engineWords({ engine: "unreachable", health: null, problem: "health check failed (0 timeout)" }).detail ?? "", /^health check failed \(0 timeout\)\. Changes wait/);
  assert.match(w.engineWords({ engine: "read-only", health: null, problem: null }).summary, /read-only/);
  assert.match(w.engineWords({ engine: "disk-full", health: null, problem: null }).summary, /disk is nearly full/);

  const ok = w.engineWords({ engine: "ok", health: "green", problem: null });
  assert.deepEqual([ok.tone, ok.label, ok.summary, ok.detail], ["ok", "OK", "OpenSearch is running beside Postgres (health green).", null]);
  assert.equal(w.engineWords({ engine: "ok", health: "red", problem: null }).tone, "warn");
});

test("migration 0100 missing: a warning, and the queue says 'not set up' rather than 0", () => {
  assert.match(w.setupWarning({ setUp: false }) ?? "", /migration 0100/);
  assert.equal(w.setupWarning({ setUp: true }), null);
  assert.equal(w.pendingWords({ setUp: false, pending: null }), "Not set up (migration 0100 not applied)");
  assert.match(w.pendingWords({ setUp: true, pending: null }), /^Not known/);
  assert.equal(w.pendingWords({ setUp: true, pending: 0 }), "None");
  assert.equal(w.pendingWords({ setUp: true, pending: 1 }), "1 change");
  assert.equal(w.pendingWords({ setUp: true, pending: 1200 }), "1,200 changes");
});

test("stored run results read in words", () => {
  assert.equal(w.resultWords("ok: 5 claimed, 5 done, 0 left"), "Done: 5 claimed, 5 done, 0 left");
  assert.equal(w.resultWords("partial: 9 claimed, 4 done, 5 left"), "Partly done: 9 claimed, 4 done, 5 left");
  assert.equal(w.resultWords("blocked: 0 indexed, 0 removed, 0 kept newer"), "Blocked (disk nearly full): 0 indexed, 0 removed, 0 kept newer");
  assert.equal(w.resultWords("failed: 0 indexed"), "Failed: 0 indexed");
  assert.equal(w.resultWords("something else"), "something else");
  assert.equal(w.resultWords(null), "No result recorded");
});

type Listed = Parameters<Words["indexWords"]>[1];
const listed: Listed = { engine: "ok", indicesKnown: true };

test("index counts against the database", () => {
  assert.deepEqual(w.indexWords(index(), listed), { counts: "1,234 indexed · 1,234 in the database", note: null, warn: false });
  assert.match(w.indexWords(index({ documents: 1230 }), listed).note ?? "", /^4 records not in the index yet/);
  assert.match(w.indexWords(index({ documents: 1235 }), listed).note ?? "", /^1 document more than the database/);
  const missing = w.indexWords(index({ exists: false, documents: null }), listed);
  assert.equal(missing.counts, "Not created · 1,234 in the database");
  assert.equal(missing.note, "The next reconcile creates it.");
  assert.equal(missing.warn, true);
  assert.deepEqual(w.indexWords(index({ readOnly: true }), listed).warn, true);
  assert.equal(w.indexWords(index({ documents: null, database: null }), listed).counts, "not known indexed · not known in the database");
  assert.equal(w.indexWords(index({ documents: null, database: null }), listed).note, null);
  // The disk states still list the indices: a missing one is missing.
  assert.equal(w.indexWords(index({ exists: false, documents: null }), { engine: "disk-full", indicesKnown: true }).counts, "Not created · 1,234 in the database");
});

test("search server unreachable, or its index list did not come back: the indices are not known, never 'not created'", () => {
  // What searchStatus() hands back for an unreachable server: every index exists: false, documents: null.
  const unread = index({ exists: false, health: null, documents: null, deletedDocuments: null, size: null });
  const down = w.indexWords(unread, { engine: "unreachable", indicesKnown: false });
  assert.deepEqual(down, { counts: "Not known (search server unreachable) · 1,234 in the database", note: null, warn: false });
  // Healthy, but _cat/indices failed or timed out.
  const unlisted = w.indexWords(unread, { engine: "ok", indicesKnown: false });
  assert.deepEqual(unlisted, { counts: "Not known (the search server did not list its indices) · 1,234 in the database", note: null, warn: false });
  for (const s of [{ engine: "unreachable", indicesKnown: false }, { engine: "ok", indicesKnown: false }, { engine: "read-only", indicesKnown: false }] as Listed[]) {
    const words = w.indexWords(unread, s);
    assert.doesNotMatch(`${words.counts} ${words.note ?? ""}`, /Not created|reconcile/, s.engine);
  }
  assert.equal(w.indexWords(index({ database: null }), { engine: "unreachable", indicesKnown: false }).counts, "Not known (search server unreachable) · not known in the database");
  assert.equal(w.indexListUnknown(listed), null);
  assert.equal(w.indexListUnknown({ engine: "not configured", indicesKnown: false }), "OpenSearch not configured");
});

type Kind = Parameters<Words["reconcileNotice"]>[0]["kinds"][number];
const kind = (k: Kind["kind"], over: Partial<Kind> = {}): Kind => ({
  kind: k,
  status: "ok",
  index: `jvb-${k}-v1`,
  created: false,
  indexed: 10,
  removed: 0,
  superseded: 0,
  failed: 0,
  ...over,
});

test("the Reconcile now notice", () => {
  assert.equal(
    w.reconcileNotice({ status: "not configured", kinds: [] }),
    "Search uses Postgres only (OpenSearch not configured). There is nothing to reconcile.",
  );
  assert.match(w.reconcileNotice({ status: "not set up", kinds: [kind("works", { status: "not set up" })] }), /^Nothing reconciled: .*migration 0100/);
  assert.equal(
    w.reconcileNotice({
      status: "ok",
      kinds: [kind("works", { indexed: 1234, removed: 2, created: true }), kind("makers", { superseded: 1 }), kind("contacts", { error: "forcemerge (0 timeout)" })],
    }),
    "Search index reconciled. Works: 1,234 indexed, 2 removed, index created; Makers: 10 indexed, 1 already newer; Contacts: 10 indexed (note: forcemerge (0 timeout)).",
  );
  const blocked = w.reconcileNotice({
    status: "blocked",
    kinds: [kind("works", { status: "blocked", indexed: 0, error: "index creation is blocked (disk nearly full); the old index is kept" }), kind("makers"), kind("contacts")],
  });
  assert.match(blocked, /^Reconcile stopped: the search server's disk is nearly full\. Works: 0 indexed, stopped \(disk nearly full: index creation is blocked/);
  const failed = w.reconcileNotice({ status: "failed", kinds: [kind("works", { status: "failed", error: "loading rows failed" }), kind("makers"), kind("contacts")] });
  assert.match(failed, /^Reconcile failed\. Works: 10 indexed, failed \(loading rows failed\); Makers/);
  assert.match(failed, /Search still works through Postgres/);
});
