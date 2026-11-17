// node --test apps/studio/src/lib/picker-search.test.ts
// The add-works and add-contacts boxes (offers, documents, shipments) over
// an in-memory Supabase and a fake OpenSearch: today's result without the
// index, the merge and the roles with it, exclusions, rows that do not load,
// "Similar matches", and errors returned rather than thrown.
import { test, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore -- plain JS test support
import { allowStudioImports } from "./opensearch/test-support.mjs";
// node --test needs the explicit extensions; the studio's tsconfig does not
// allow them (test files are not type-checked by the app).
// @ts-ignore TS5097
import { fakeSupabase, type Row } from "./test-support/fake-supabase.ts";
// @ts-ignore TS5097
import { testSearchConfig } from "./opensearch/config.ts";
// @ts-ignore TS5097
import { resetCircuit } from "./opensearch/client.ts";

allowStudioImports();
type PickerModule = typeof import("./picker-search");
type SearchModule = typeof import("./opensearch/search");
let picker: PickerModule;
let search: SearchModule;
before(async () => {
  // @ts-ignore TS5097
  picker = (await import("./picker-search.ts")) as PickerModule;
  // The same module instance picker-search.ts loads through "@/lib/opensearch/search".
  // @ts-ignore TS5097
  search = (await import("./opensearch/search.ts")) as SearchModule;
});

const cfg = testSearchConfig("http://127.0.0.1:1", "oslib-picker");
type Body = Record<string, unknown>;
type OsAnswer = { strict?: string[]; fuzzy?: string[] } | Error;
let osRequests: { url: string; body: Body }[] = [];
let osAnswer: (kind: "works" | "contacts" | "makers") => OsAnswer = () => ({});
const realFetch = globalThis.fetch;
const realError = console.error;

beforeEach(() => {
  osRequests = [];
  osAnswer = () => ({});
  resetCircuit();
  search.setSearchConfigForTests(cfg);
  console.error = () => {};
  globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => {
    const url = String(input);
    const body = JSON.parse(String(init.body ?? "{}")) as Body;
    osRequests.push({ url, body });
    const kind = url.includes("-works-") ? "works" : url.includes("-contacts-") ? "contacts" : "makers";
    const a = osAnswer(kind);
    if (a instanceof Error) throw a;
    const fuzzy = JSON.stringify(body).includes("fuzziness");
    const ids = (fuzzy ? a.fuzzy : a.strict) ?? [];
    const size = typeof body.size === "number" ? body.size : ids.length;
    return new Response(JSON.stringify({ hits: { hits: ids.slice(0, size).map((_id) => ({ _id })) } }), { status: 200 });
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  console.error = realError;
  search.setSearchConfigForTests(undefined);
});

// ---------------------------------------------------------------- fixtures

const wid = (n: number) => `w${String(n).padStart(3, "0")}`;
/** A work as vw_pieces_list shows it (a trashed work is simply not there). */
const work = (n: number, over: Row = {}): Row => ({
  id: wid(n),
  stock_number: `2026-${String(n).padStart(4, "0")}`,
  legacy_stock_number: null,
  title: `Netsuke ${n}`,
  medium: "Ivory",
  period: "Edo",
  status: "in_stock",
  year: null,
  maker_name: "Masanao",
  ledger: "jvb",
  marked_price_gbp: 1000,
  ...over,
});

/** pieces_search answers these ids in this order (its rows are stock rows; the boxes read only ids and numbers). */
function worksDb(ranked: number[], opts: { view?: number[]; trashed?: number[]; fail?: "rpc" | "view" } = {}) {
  const inView = new Set(opts.view ?? ranked);
  const all = [...new Set([...ranked, ...(opts.view ?? [])])];
  return fakeSupabase({
    tables: {
      vw_pieces_list: all.filter((n) => inView.has(n) && !(opts.trashed ?? []).includes(n)).map((n) => work(n)),
      // The trash is in the union view; the boxes must never read it.
      vw_pieces_all: all.map((n) => work(n)),
    },
    rpc: { pieces_search: () => ranked.map((n) => work(n)) },
    fail: (req) =>
      (opts.fail === "rpc" && req.rpc === "pieces_search") || (opts.fail === "view" && req.table === "vw_pieces_list")
        ? { message: `${opts.fail} failed`, code: "XX000" }
        : null,
  });
}
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

// ---------------------------------------------------------------- works

test("without OpenSearch the box is today's: pieces_search's order, existing works out, first 20, from vw_pieces_list", async () => {
  search.setSearchConfigForTests(null);
  const db = worksDb(range(1, 40), { trashed: [4] });
  const out = await picker.pickWorks(db.client as never, "netsuke", { roles: ["admin"], exclude: new Set([wid(2), wid(3)]) });
  assert.equal(out.error, null);
  assert.equal(out.similar, false);
  assert.deepEqual(ids(out.rows), [1, ...range(5, 23)].map(wid));
  assert.equal(osRequests.length, 0);
  const tables = db.calls.filter((c: { table: string | null }) => c.table).map((c: { table: string }) => c.table);
  assert.ok(tables.length > 0 && tables.every((t: string) => t === "vw_pieces_list"), `read ${tables.join(", ")}`);
  // Every column the boxes show, and nothing else.
  assert.deepEqual(Object.keys(out.rows[0]!).sort(), ["id", "ledger", "maker_name", "medium", "period", "status", "stock_number", "title", "year"]);
  const rpc = db.calls.find((c: { rpc: string | null }) => c.rpc);
  assert.deepEqual(rpc?.args, { q: "netsuke" });
});

test("the accountant and users with no role never reach the index; Postgres answers as today", async () => {
  osAnswer = () => ({ strict: [wid(9)] });
  for (const roles of [["accountant"], [], ["capture"]]) {
    const db = worksDb([1, 2]);
    const out = await picker.pickWorks(db.client as never, "netsuke", { roles });
    assert.deepEqual(ids(out.rows), [wid(1), wid(2)]);
  }
  assert.equal(osRequests.length, 0);
});

test("admin and staff: the index's hits merged in, an id that does not load dropped and the next one shown", async () => {
  // Index: w9 (trashed since it was indexed), w3, w2. Postgres: w1, w2.
  osAnswer = (kind) => (kind === "works" ? { strict: [wid(9), wid(3), wid(2)] } : {});
  for (const roles of [["staff"], ["admin"]]) {
    osRequests = [];
    const db = worksDb([1, 2], { view: [1, 2, 3, 9], trashed: [9] });
    const out = await picker.pickWorks(db.client as never, "netsuke", { roles });
    assert.equal(out.error, null);
    assert.equal(out.similar, false);
    assert.deepEqual(ids(out.rows), [wid(3), wid(2), wid(1)]);
    assert.equal(osRequests.length, 1, "one strict pass; nothing fuzzy when it matched");
    assert.ok(osRequests[0]!.url.includes("oslib-picker-works-v"));
  }
});

test("a stock number the user typed comes first, whatever the index ranks", async () => {
  osAnswer = () => ({ strict: [wid(7), wid(5)] });
  const db = worksDb([5, 6], { view: [5, 6, 7] });
  const out = await picker.pickWorks(db.client as never, "2026-0006", { roles: ["staff"] });
  assert.deepEqual(ids(out.rows), [wid(6), wid(7), wid(5)]);
});

test("the index is asked for the rows shown, the record's own and a margin", async () => {
  osAnswer = () => ({ strict: [] });
  const exclude = new Set(range(1, 30).map(wid));
  await picker.pickWorks(worksDb([]).client as never, "netsuke", { roles: ["staff"], exclude });
  assert.equal(osRequests[0]!.body.size, picker.PICKER_SHOW + 30 + 40);
  // Below the size at which highlights are asked for: a picker shows no "matched in".
  assert.ok(!("highlight" in osRequests[0]!.body));
});

test("nothing matched exactly: the typo-tolerant pass's works, marked similar", async () => {
  osAnswer = () => ({ strict: [], fuzzy: [wid(4), wid(5)] });
  const db = worksDb([], { view: [4, 5] });
  const out = await picker.pickWorks(db.client as never, "netsuek", { roles: ["staff"] });
  assert.equal(out.similar, true);
  assert.deepEqual(ids(out.rows), [wid(4), wid(5)]);
  assert.equal(osRequests.length, 2);
  // Similar works that are all on the record already: nothing to show, nothing to label.
  const none = await picker.pickWorks(worksDb([], { view: [4, 5] }).client as never, "netsuek", {
    roles: ["staff"],
    exclude: new Set([wid(4), wid(5)]),
  });
  assert.deepEqual(none.rows, []);
  assert.equal(none.similar, false);
});

test("the index down or slow: exactly today's result", async () => {
  osAnswer = () => new Error("connect ECONNREFUSED");
  const db = worksDb([2, 1]);
  const out = await picker.pickWorks(db.client as never, "netsuke", { roles: ["admin"] });
  assert.deepEqual(ids(out.rows), [wid(2), wid(1)]);
  assert.equal(out.similar, false);
  assert.equal(out.error, null);
});

test("ids that do not load never leave the box short: the next window is loaded", async () => {
  // 70 indexed ids that no longer load (trashed), then Postgres's 30 real ones.
  const stale = range(101, 170);
  osAnswer = () => ({ strict: stale.map(wid) });
  const db = worksDb(range(1, 30), { view: [...range(1, 30), ...stale], trashed: stale });
  const out = await picker.pickWorks(db.client as never, "netsuke", { roles: ["staff"], exclude: new Set([wid(1)]) });
  // The index was asked for 61 ids, so 61 stale ones come first.
  assert.deepEqual(ids(out.rows), range(2, 21).map(wid));
  const reads = db.calls.filter((c: { table: string | null }) => c.table === "vw_pieces_list").length;
  assert.ok(reads >= 2 && reads <= 4, `${reads} row reads`);
});

test("errors are returned, never thrown, with no rows", async () => {
  search.setSearchConfigForTests(null);
  const a = await picker.pickWorks(worksDb([1], { fail: "rpc" }).client as never, "netsuke", { roles: ["admin"] });
  assert.deepEqual(a.rows, []);
  assert.equal(a.error?.message, "rpc failed");
  const b = await picker.pickWorks(worksDb([1], { fail: "view" }).client as never, "netsuke", { roles: ["admin"] });
  assert.deepEqual(b.rows, []);
  assert.equal(b.similar, false);
  assert.match(b.error?.message ?? "", /view failed/);
});

// ---------------------------------------------------------------- contacts

const cid = (n: number) => `c${String(n).padStart(3, "0")}`;
const contact = (n: number, over: Row = {}): Row => ({
  id: cid(n),
  first_name: "Hiroshi",
  last_name: `Tanaka ${n}`,
  salutation: null,
  email: `h${n}@example.com`,
  unsubscribed_at: null,
  email_bounced_at: null,
  erased_at: null,
  notes: "never selected",
  ...over,
});

function contactsDb(ranked: number[], opts: { table?: Row[]; fail?: "rpc" | "table" } = {}) {
  return fakeSupabase({
    tables: { crm_contacts: opts.table ?? ranked.map((n) => contact(n)) },
    rpc: { crm_contacts_search: () => ranked.map((n) => contact(n)) },
    fail: (req) =>
      (opts.fail === "rpc" && req.rpc === "crm_contacts_search") || (opts.fail === "table" && req.table === "crm_contacts")
        ? { message: `${opts.fail} failed` }
        : null,
  });
}

test("contacts without the index: crm_contacts_search's order, recipients out before the first 20, rows from crm_contacts", async () => {
  search.setSearchConfigForTests(null);
  const db = contactsDb(range(1, 30));
  const out = await picker.pickContacts(db.client as never, "Tanaka", { roles: ["staff"], exclude: new Set([cid(1), cid(2)]) });
  assert.equal(out.error, null);
  assert.deepEqual(ids(out.rows), range(3, 22).map(cid));
  assert.deepEqual(Object.keys(out.rows[0]!).sort(), [
    "email",
    "email_bounced_at",
    "first_name",
    "id",
    "last_name",
    "salutation",
    "unsubscribed_at",
  ]);
  const tables = db.calls.filter((c: { table: string | null }) => c.table).map((c: { table: string }) => c.table);
  assert.ok(tables.every((t: string) => t === "crm_contacts"));
  assert.equal(osRequests.length, 0);
});

test("contacts: the index merged in for admin and staff only; an erased contact is never offered", async () => {
  osAnswer = (kind) => (kind === "contacts" ? { strict: [cid(8), cid(9), cid(2)] } : {});
  // c008 was erased (pseudonymised) after it was indexed.
  const table = [contact(1), contact(2), contact(8, { first_name: "Erased contact", erased_at: "2026-11-01T00:00:00Z" }), contact(9)];
  const out = await picker.pickContacts(contactsDb([1, 2], { table }).client as never, "Tanaka", { roles: ["admin"] });
  assert.deepEqual(ids(out.rows), [cid(9), cid(2), cid(1)]);
  assert.ok(osRequests.every((r) => r.url.includes("-contacts-")));

  osRequests = [];
  const acc = await picker.pickContacts(contactsDb([1, 2], { table }).client as never, "Tanaka", { roles: ["accountant"] });
  assert.deepEqual(ids(acc.rows), [cid(1), cid(2)]);
  assert.equal(osRequests.length, 0);
});

test("contacts: similar matches when nothing matched exactly; errors returned", async () => {
  osAnswer = () => ({ strict: [], fuzzy: [cid(5)] });
  const out = await picker.pickContacts(contactsDb([], { table: [contact(5)] }).client as never, "Tanaak", { roles: ["staff"] });
  assert.equal(out.similar, true);
  assert.deepEqual(ids(out.rows), [cid(5)]);

  search.setSearchConfigForTests(null);
  const a = await picker.pickContacts(contactsDb([1], { fail: "rpc" }).client as never, "Tanaka", { roles: ["staff"] });
  assert.deepEqual(a, { rows: [], similar: false, error: { message: "rpc failed" } });
  const b = await picker.pickContacts(contactsDb([1], { fail: "table" }).client as never, "Tanaka", { roles: ["staff"] });
  assert.deepEqual(b.rows, []);
  assert.match(b.error?.message ?? "", /table failed/);
});

test("an empty query asks nothing", async () => {
  const w = worksDb([1]);
  const c = contactsDb([1]);
  assert.deepEqual((await picker.pickWorks(w.client as never, "   ", { roles: ["admin"] })).rows, []);
  assert.deepEqual((await picker.pickContacts(c.client as never, "", { roles: ["admin"] })).rows, []);
  assert.equal(w.calls.length + c.calls.length, 0);
  assert.equal(osRequests.length, 0);
});
