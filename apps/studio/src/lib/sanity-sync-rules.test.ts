// node --test apps/studio/src/lib/sanity-sync-rules.test.ts
// The website sync's offline decisions: profile text, the asset lookup's
// size, how failures are classed, and what a batch writes back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
// node --test needs the explicit extensions; the studio's tsconfig does not
// allow them (test files are not type-checked by the app).
// @ts-ignore TS5097
import { sanitizeHtml } from "./sanitize-html.ts";
import {
  ASSET_LOOKUP_BYTES,
  assetKeyChunks,
  entityKey,
  htmlToText,
  isReferenceRefusal,
  overlappedEntities,
  sanityErrorTypes,
  sanityUploadFailureIsPermanent,
  settleBatch,
  storageFailureIsPermanent,
  type Outcome,
  // @ts-ignore TS5097
} from "./sanity-sync-rules.ts";

/* ---- htmlToText ---------------------------------------------------------- */

// Run through the sanitiser first: that is the form profile_html is stored in.
const bio = (html: string) => htmlToText(sanitizeHtml(html));

test("a line break, written <br /> by the sanitiser, starts a new paragraph", () => {
  assert.equal(sanitizeHtml("<p>a<br>b</p>"), "<p>a<br />b</p>");
  assert.equal(bio("<p>Born in Kyoto in 1890.<br>Studied under Tanabe.</p>"), "Born in Kyoto in 1890.\n\nStudied under Tanabe.");
  assert.equal(bio("<p>Teiten, 1929.<br/>Exhibited at Bunten.<br >Died 1950.</p>"), "Teiten, 1929.\n\nExhibited at Bunten.\n\nDied 1950.");
});

test("blocks are paragraphs, opening tags included; list items each on their own line", () => {
  assert.equal(bio("First<p>Second</p>"), "First\n\nSecond");
  assert.equal(bio("<h2>Life</h2><p>Born <b>1890</b>.</p><ul><li>one</li><li>two</li></ul>"), "Life\n\nBorn 1890.\n\none\n\ntwo");
  assert.equal(htmlToText('a<div class="x">b</div>c'), "a\n\nb\n\nc");
});

test("source whitespace is collapsed as a browser shows it", () => {
  assert.equal(bio("<p>Born in\n   Kyoto</p>\n\n<p>  Later  </p>"), "Born in Kyoto\n\nLater");
});

test("entities are decoded once, &amp; last; non-breaking spaces become spaces", () => {
  assert.equal(bio("<p>Tom &amp; Jerry &lt;3</p>"), "Tom & Jerry <3");
  // The text "&lt;" typed literally is stored as "&amp;lt;" and must stay "&lt;".
  assert.equal(bio("<p>write &amp;lt; for less-than</p>"), "write &lt; for less-than");
  assert.equal(htmlToText("<p>a&nbsp;b c &#233;t&#xE9; &quot;q&quot; it&#39;s</p>"), 'a b c été "q" it\'s');
});

test("empty or tag-only profiles give null", () => {
  for (const html of [null, undefined, "", "<p></p>", "<p><br></p>", " <ul><li> </li></ul> "]) assert.equal(htmlToText(html), null, String(html));
});

/* ---- asset lookup ---------------------------------------------------------- */

const uuid = (n: number) => `${n.toString(16).padStart(8, "0")}-2d3a-4b5c-8d9e-0f1a2b3c4d5e`;

/** What the route asks about for a full batch: 12 works, 8 photographs and a tile each. */
function batchKeys(): string[] {
  const keys: string[] = [];
  for (let p = 0; p < 12; p++) {
    for (let i = 0; i < 8; i++) keys.push(`piece-derivatives/${uuid(p)}/${uuid(1000 + p * 8 + i)}.jpg`);
    keys.push(`piece-derivatives/${uuid(p)}/${uuid(1000 + p * 8)}.sq-1600x1200.jpg`);
  }
  return keys;
}

test("asset keys go in chunks under the byte budget, each once, in order", () => {
  const keys = batchKeys();
  const chunks = assetKeyChunks([...keys, keys[0]!, keys[5]!, ""]);
  assert.ok(chunks.length > 1);
  assert.deepEqual(chunks.flat(), keys);
  for (const c of chunks) assert.ok(encodeURIComponent(c.map((k) => `"${k}"`).join(",")).length <= ASSET_LOOKUP_BYTES);
  assert.deepEqual(assetKeyChunks([]), []);
  // A key longer than the budget still goes, on its own.
  const long = `piece-derivatives/${"x".repeat(5000)}.jpg`;
  assert.deepEqual(assetKeyChunks(["a", long, "b"]), [["a"], [long], ["b"]]);
});

test("each chunk's lookup stays well inside the gateway's 8 KB request line", async () => {
  const urls: string[] = [];
  const supabase = createClient("http://studio.invalid", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input: string | URL | Request) => {
        urls.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
        return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
      },
    },
  });
  for (const chunk of assetKeyChunks(batchKeys())) {
    const { error } = await supabase.from("sanity_assets").select("storage_path, asset_id").in("storage_path", chunk);
    assert.equal(error, null);
  }
  assert.ok(urls.length > 1);
  for (const url of urls) assert.ok(url.length < 6000, `request line of ${url.length} bytes`);
});

/* ---- failures ---------------------------------------------------------------- */

test("a storage object that is not there is left out; anything else is retried", () => {
  // Self-hosted storage answers a missing object with 400 and statusCode "404".
  assert.equal(storageFailureIsPermanent({ name: "StorageApiError", status: 400, statusCode: "404" }), true);
  assert.equal(storageFailureIsPermanent({ status: 404, statusCode: "404" }), true);
  assert.equal(storageFailureIsPermanent({ status: 400, statusCode: "InvalidKey" }), true);
  for (const e of [
    { name: "StorageUnknownError", message: "fetch failed" },
    { status: 500, statusCode: "500" },
    { status: 503 },
    { status: 400, statusCode: "500" },
    { status: 400, statusCode: "403" },
    { status: 429, statusCode: "429" },
    { status: 401 },
    null,
    "boom",
  ]) {
    assert.equal(storageFailureIsPermanent(e), false, JSON.stringify(e));
  }
});

test("Sanity refusing the file is final; timeouts, limits, credentials and 5xx are retried", () => {
  for (const s of [400, 404, 413, 415, 422]) assert.equal(sanityUploadFailureIsPermanent(s), true, String(s));
  for (const s of [401, 403, 408, 425, 429, 500, 502, 503, 504]) assert.equal(sanityUploadFailureIsPermanent(s), false, String(s));
});

test("a delete refused for references is told from any other failure, past 500 characters too", () => {
  const referencing = Array.from({ length: 30 }, (_, i) => `event-${uuid(i)}`);
  const body = JSON.stringify({
    error: {
      description: "Mutation(s) failed with 1 error(s)",
      items: [
        {
          error: {
            description: `Document "work-x" cannot be deleted as there are references to it from "${referencing[0]}"`,
            id: "work-x",
            referencingIDs: referencing,
            type: "documentHasExistingReferencesError",
          },
          index: 0,
        },
      ],
      type: "mutationError",
    },
  });
  assert.ok(body.indexOf("documentHasExistingReferencesError") > 500);
  assert.deepEqual(sanityErrorTypes(body), ["mutationError", "documentHasExistingReferencesError"]);
  assert.equal(isReferenceRefusal(409, body), true);
  // Truncated JSON still names the type.
  assert.equal(isReferenceRefusal(409, body.slice(0, body.indexOf("index"))), true);
  assert.equal(isReferenceRefusal(429, body), false);
  assert.equal(isReferenceRefusal(503, "Service Unavailable"), false);
  assert.equal(isReferenceRefusal(409, JSON.stringify({ error: { type: "mutationError", items: [{ error: { type: "documentRevisionIdDoesNotMatchError" } }] } })), false);
  assert.equal(isReferenceRefusal(401, JSON.stringify({ error: "Unauthorized", message: "Session not found" })), false);
});

/* ---- settling a batch ---------------------------------------------------------- */

const P1 = uuid(1);
const P2 = uuid(2);
const P3 = uuid(3);
const P4 = uuid(4);
const M1 = uuid(11);
const M2 = uuid(12);
const L1 = uuid(21);
const L2 = uuid(22);

test("held rows stay unprocessed; deferred work is queued again with no state; only written entities are swept", () => {
  const rows = [
    { id: 1, entity_type: "maker", entity_id: M1 },
    { id: 2, entity_type: "piece", entity_id: P1 },
    { id: 3, entity_type: "piece", entity_id: P2 },
    { id: 4, entity_type: "piece", entity_id: P2 },
    { id: 5, entity_type: "piece", entity_id: P3 },
    { id: 6, entity_type: "list", entity_id: L1 },
    { id: 7, entity_type: "piece", entity_id: P4 },
    { id: 8, entity_type: "maker", entity_id: M2 },
    { id: 9, entity_type: "list", entity_id: L2 },
  ];
  const outcomes = new Map<string, Outcome>([
    // M1: no outcome, pushed as it stands.
    [entityKey("piece", P1), { kind: "pushed", requeue: true }],
    [entityKey("piece", P2), { kind: "held", reason: "Could not read x from storage: fetch failed" }],
    [entityKey("piece", P3), { kind: "deferred" }],
    [entityKey("list", L1), { kind: "gave_up", reason: "Gave up after 6 h of failures: boom" }],
    [entityKey("piece", P4), { kind: "pushed", incomplete: "Published without 1 image" }],
    [entityKey("maker", M2), { kind: "refused", reason: "still referenced" }],
    [entityKey("list", L2), { kind: "held", reason: "Could not read the list's exclusions" }],
  ]);
  const plan = settleBatch(rows, outcomes);
  assert.deepEqual(plan.done, [1, 2, 5, 6, 7, 8]);
  assert.deepEqual(plan.requeue, [
    { type: "piece", id: P1 },
    { type: "piece", id: P3 },
  ]);
  assert.deepEqual(
    plan.state.map((s) => [s.type, s.id, s.status, s.pushed]),
    [
      ["maker", M1, "ok", true],
      ["piece", P1, "ok", true],
      ["piece", P2, "error", false],
      ["list", L1, "error", false],
      ["piece", P4, "error", true],
      ["maker", M2, "error", false],
      ["list", L2, "error", false],
    ],
  );
  assert.match(plan.state.find((s) => s.id === P2)!.error!, /^Not pushed; will retry: Could not read/);
  assert.equal(plan.state.find((s) => s.id === M1)!.error, null);
  // Held, given up and deferred entities keep their old documents and new uploads: never swept.
  assert.deepEqual(
    plan.sweep.map((e) => e.id),
    [M1, P1, P4, M2],
  );
  // Overlap check: written and not queued again anyway.
  assert.deepEqual(
    plan.written.map((e) => e.id),
    [M1, P4],
  );
});

test("an entity written by an overlapping run is queued once more; one still waiting unclaimed needs nothing", () => {
  const batch = [
    { id: 10, entity_type: "piece", entity_id: P1 },
    { id: 11, entity_type: "piece", entity_id: P2 },
    { id: 14, entity_type: "piece", entity_id: P2 },
    { id: 12, entity_type: "maker", entity_id: M1 },
    { id: 13, entity_type: "list", entity_id: L1 },
  ];
  const written = [
    { type: "piece" as const, id: P1 },
    { type: "piece" as const, id: P2 },
    { type: "maker" as const, id: M1 },
    { type: "list" as const, id: L1 },
  ];
  const row = (id: number, entity_type: string, entity_id: string, claimed: boolean, processed: boolean) => ({
    id,
    entity_type,
    entity_id,
    claimed_at: claimed ? "2026-11-16T10:00:00Z" : null,
    processed_at: processed ? "2026-11-16T10:00:05Z" : null,
  });
  const later = [
    ...batch.map((r) => row(r.id, r.entity_type, r.entity_id, true, false)), // this run's own rows
    row(20, "piece", P1, true, false), // another run claimed a later edit: maybe wrote first
    row(13, "piece", P2, true, true), // older than this run's latest row for P2: no matter
    row(21, "maker", M1, true, true), // processed by another run
    row(22, "maker", M1, false, false), // …but a later one still waits: whoever claims it reads after us
    row(23, "list", L1, false, false), // only waiting
    row(24, "piece", P3, true, true), // not this run's entity
  ];
  assert.deepEqual(overlappedEntities(batch, later, written), [{ type: "piece", id: P1 }]);
  assert.deepEqual(overlappedEntities(batch, [], written), []);
});
