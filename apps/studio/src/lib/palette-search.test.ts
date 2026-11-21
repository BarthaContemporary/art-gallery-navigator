// node --test apps/studio/src/lib/palette-search.test.ts
// The ⌘K palette's search (GET /api/search) over an in-memory Supabase and a
// fake OpenSearch: the response keys, role gating (the accountant gets no
// contacts and no engine), the groups failing on their own, records only for
// the tables a role may read, "Similar matches" and "matched in …".
import { test, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore -- plain JS test support
import { allowStudioImports } from "./opensearch/test-support.mjs";
// node --test needs the explicit extensions; the studio's tsconfig does not
// allow them (test files are not type-checked by the app).
// @ts-ignore TS5097
import { fakeSupabase, type Row, type Req } from "./test-support/fake-supabase.ts";
// @ts-ignore TS5097
import { testSearchConfig } from "./opensearch/config.ts";
// @ts-ignore TS5097
import { resetCircuit } from "./opensearch/client.ts";

allowStudioImports();
type PaletteModule = typeof import("./palette-search");
type SearchModule = typeof import("./opensearch/search");
let palette: PaletteModule;
let search: SearchModule;
before(async () => {
  // @ts-ignore TS5097
  palette = (await import("./palette-search.ts")) as PaletteModule;
  // The same module instance palette-search.ts loads through "@/lib/opensearch/search".
  // @ts-ignore TS5097
  search = (await import("./opensearch/search.ts")) as SearchModule;
});

const cfg = testSearchConfig("http://127.0.0.1:1", "oslib-palette");
type Body = Record<string, unknown>;
type Hit = string | [string, string[]];
type OsAnswer = { strict?: Hit[]; fuzzy?: Hit[] } | Error;
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
    const hits = ((fuzzy ? a.fuzzy : a.strict) ?? []).map((h) =>
      Array.isArray(h) ? { _id: h[0], highlight: Object.fromEntries(h[1].map((f) => [f, ["…"]])) } : { _id: h },
    );
    return new Response(JSON.stringify({ hits: { hits } }), { status: 200 });
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  console.error = realError;
  search.setSearchConfigForTests(undefined);
});

// ---------------------------------------------------------------- fixtures

const wid = (n: number) => `w${String(n).padStart(3, "0")}`;
const cid = (n: number) => `c${String(n).padStart(3, "0")}`;
const mid = (n: number) => `m${String(n).padStart(3, "0")}`;
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

const work = (n: number): Row => ({
  id: wid(n),
  stock_number: `2026-${String(n).padStart(4, "0")}`,
  legacy_stock_number: null,
  title: `Netsuke of a hare ${n}`,
  maker_name: "Masanao",
  status: "in_stock",
});
const contact = (n: number): Row => ({ id: cid(n), first_name: "Lucy", last_name: `Hare ${n}`, email: `lucy${n}@example.com` });
const maker = (n: number): Row => ({
  id: mid(n),
  display_name: `Masanao ${n}`,
  native_name: "正直",
  romanized_name: null,
  life_dates: "1848–1922",
  region: "Japan",
  // Matches the tests' "hare" through the school, which the palette does not show.
  school_or_workshop: "Hare carvers of Kyoto",
});

type DbOptions = {
  works?: number[];
  /** Works in the live view (default: every ranked work). A work missing here is trashed or hidden. */
  view?: number[];
  contacts?: number[];
  makers?: number[];
  fail?: (req: Req) => boolean;
};

/** Every table the palette reads, with a hare in each record table. */
function db(opts: DbOptions = {}) {
  const ranked = opts.works ?? [1, 2, 3];
  const view = opts.view ?? ranked;
  const contacts = opts.contacts ?? [1, 2];
  return fakeSupabase({
    tables: {
      vw_pieces_list: view.map(work),
      vw_pieces_all: [...new Set([...ranked, ...view])].map(work),
      makers: (opts.makers ?? [1]).map(maker),
      crm_contacts: contacts.map(contact),
      offers: [
        { id: "o1", title: "Hares for the autumn fair", kind: "fair_preview", updated_at: "2026-11-01" },
        { id: "o2", title: "Tigers", kind: "offer", updated_at: "2026-11-02" },
      ],
      piece_documents: [
        { id: "d1", title: "Hare certificate", doc_type: "certificate", reference: "C-1", created_at: "2026-10-01" },
        { id: "d2", title: null, doc_type: "sale_invoice", reference: "HARE-INV-7", created_at: "2026-10-02" },
      ],
      shipments: [{ id: "s1", kind: "export", reference: "HARE-EXP", shipment_date: "2026-09-12", updated_at: "2026-09-12" }],
      piece_lists: [{ id: "pl1", name: "Hare netsuke", updated_at: "2026-08-01" }],
      crm_lists: [{ id: "cl1", name: "Hare collectors", updated_at: "2026-08-02" }],
      crm_campaigns: [{ id: "cc1", name: "Autumn", subject: "The year of the hare", updated_at: "2026-08-03" }],
    },
    rpc: {
      pieces_search: () => ranked.map(work),
      crm_contacts_search: () => contacts.map(contact),
    },
    fail: (req) => (opts.fail?.(req) ? { message: "boom", code: "57014" } : null),
  });
}
type Fake = ReturnType<typeof db>;
const tablesRead = (d: Fake) => d.calls.filter((c: Req) => c.table).map((c: Req) => c.table as string);
const rpcsCalled = (d: Fake) => d.calls.filter((c: Req) => c.rpc).map((c: Req) => c.rpc as string);
const RECORD_TABLES = ["offers", "piece_documents", "shipments", "piece_lists", "crm_lists", "crm_campaigns"];

// ---------------------------------------------------------------- the answer

test("every key the palette reads, with OpenSearch unconfigured: today's Postgres results", async () => {
  search.setSearchConfigForTests(null);
  const d = db({ works: range(1, 9) });
  const out = await palette.paletteSearch(d.client as never, "hare", ["admin"]);
  assert.deepEqual(Object.keys(out).sort(), ["contacts", "failed", "makers", "pieces", "records", "similar"]);
  assert.deepEqual(
    out.pieces.map((p) => p.id),
    range(1, 6).map(wid),
    "pieces_search's order, the first six",
  );
  assert.deepEqual(out.pieces[0], {
    id: wid(1),
    stock_number: "2026-0001",
    title: "Netsuke of a hare 1",
    maker_name: "Masanao",
    status: "in_stock",
    matched: null,
  });
  assert.deepEqual(out.contacts, [
    { id: cid(1), name: "Lucy Hare 1", email: "lucy1@example.com" },
    { id: cid(2), name: "Lucy Hare 2", email: "lucy2@example.com" },
  ]);
  assert.deepEqual(out.similar, { pieces: false, makers: false, contacts: false });
  assert.deepEqual(out.failed, []);
  assert.equal(osRequests.length, 0);
  // Works are read from the live view only, never the union with the trash.
  assert.ok(!tablesRead(d).includes("vw_pieces_all"));
});

test("works: the first six of twelve ids that load; a trashed or hidden work is skipped", async () => {
  search.setSearchConfigForTests(null);
  // Ranked 1-14; 2, 4 and 6 are no longer in the live view.
  const d = db({ works: range(1, 14), view: range(1, 14).filter((n) => ![2, 4, 6].includes(n)) });
  const out = await palette.paletteSearch(d.client as never, "hare", ["staff"]);
  assert.deepEqual(
    out.pieces.map((p) => p.id),
    [1, 3, 5, 7, 8, 9].map(wid),
  );
  const load = d.calls.find((c: Req) => c.table === "vw_pieces_list");
  assert.deepEqual((load?.filters[0]?.value as string[]).length, 12, "twelve ids asked for");
});

test("works: pieces_search is asked for twelve rows, not one for every match; the inventory's call stays uncapped", async () => {
  // Unconfigured: Postgres's twelve, the first six shown, as before the engine.
  search.setSearchConfigForTests(null);
  const d = db({ works: range(1, 40) });
  const out = await palette.paletteSearch(d.client as never, "ha", ["admin"]);
  const rpc = d.calls.filter((c: Req) => c.rpc === "pieces_search");
  assert.equal(rpc.length, 1);
  assert.equal(rpc[0]!.limit, 12, "the palette caps pieces_search at its twelve ids");
  assert.deepEqual(
    out.pieces.map((p) => p.id),
    range(1, 6).map(wid),
  );
  // Configured: the same cap on Postgres beside the engine's twelve.
  search.setSearchConfigForTests(cfg);
  osAnswer = (kind) => (kind === "works" ? { strict: [wid(30)] } : {});
  const withEngine = db({ works: range(1, 40) });
  await palette.paletteSearch(withEngine.client as never, "hare", ["staff"]);
  assert.equal(withEngine.calls.find((c: Req) => c.rpc === "pieces_search")?.limit, 12);
  assert.equal(osRequests.find((r) => r.url.includes("-works-"))?.body.size, 12);
  // searchWorkIds without postgresLimit (the inventory): every match, no limit.
  const inventory = db({ works: range(1, 40) });
  const all = await search.searchWorkIds(inventory.client as never, "hare", { roles: ["admin"] });
  assert.equal(inventory.calls.find((c: Req) => c.rpc === "pieces_search")?.limit, null);
  assert.ok(all.ids.length >= 40);
});

test("works: within the cap, the work whose stock number is the query still leads the engine's hits", async () => {
  // pieces_search's ORDER BY puts the exact stock number first, then contained ones.
  const d = fakeSupabase({
    tables: { vw_pieces_list: range(1, 40).map(work), makers: [], crm_contacts: [] },
    rpc: {
      pieces_search: () => [work(25), ...range(1, 40).filter((n) => n !== 25).map(work)],
      crm_contacts_search: () => [],
    },
  });
  osAnswer = (kind) => (kind === "works" ? { strict: [wid(33), wid(34)] } : {});
  const out = await palette.paletteSearch(d.client as never, "2026-0025", ["admin"]);
  assert.equal(d.calls.find((c: Req) => c.rpc === "pieces_search")?.limit, 12);
  assert.deepEqual(
    out.pieces.slice(0, 3).map((p) => p.id),
    [wid(25), wid(33), wid(34)],
  );
});

test("makers: up to four, with native name, dates and region as the detail", async () => {
  search.setSearchConfigForTests(null);
  const d = db({ makers: range(1, 6) });
  const out = await palette.paletteSearch(d.client as never, "masanao", ["accountant"]);
  assert.equal(out.makers.length, 4);
  assert.deepEqual(out.makers[0], { id: mid(1), name: "Masanao 1", detail: "正直 · 1848–1922 · Japan" });
});

// ---------------------------------------------------------------- roles

test("the accountant: no contacts, no CRM query and no OpenSearch request at all", async () => {
  osAnswer = () => ({ strict: [wid(2)] });
  const d = db();
  const out = await palette.paletteSearch(d.client as never, "hare", ["accountant"]);
  assert.deepEqual(out.contacts, []);
  assert.equal(osRequests.length, 0, "the engine is never asked for the accountant");
  assert.ok(!rpcsCalled(d).includes("crm_contacts_search"));
  assert.ok(!tablesRead(d).includes("crm_contacts"));
  // Works and makers still answer, from Postgres.
  assert.deepEqual(
    out.pieces.map((p) => p.id),
    [1, 2, 3].map(wid),
  );
  assert.equal(out.makers.length, 1);
  // Records: only the tables the accountant has a policy on.
  const recordTables = tablesRead(d).filter((t) => RECORD_TABLES.includes(t));
  assert.deepEqual(recordTables.sort(), ["piece_documents", "shipments"]);
  assert.deepEqual(
    out.records.map((r) => r.type),
    ["document", "document", "shipment"],
  );
  assert.deepEqual(out.failed, []);
});

test("no role at all: nothing from the CRM, no records, no engine", async () => {
  osAnswer = () => ({ strict: [wid(2)] });
  const d = db();
  const out = await palette.paletteSearch(d.client as never, "hare", []);
  assert.deepEqual(out.contacts, []);
  assert.deepEqual(out.records, []);
  assert.equal(osRequests.length, 0);
  assert.ok(!rpcsCalled(d).includes("crm_contacts_search"));
  assert.deepEqual(
    tablesRead(d).filter((t) => RECORD_TABLES.includes(t)),
    [],
  );
});

test("staff: every record table, through the user's own client, three rows each at most", async () => {
  search.setSearchConfigForTests(null);
  const d = db();
  const out = await palette.paletteSearch(d.client as never, "hare", ["staff"]);
  assert.deepEqual(tablesRead(d).filter((t) => RECORD_TABLES.includes(t)).sort(), [...RECORD_TABLES].sort());
  for (const c of d.calls.filter((c: Req) => c.table && RECORD_TABLES.includes(c.table))) assert.equal(c.limit, 3);
  assert.deepEqual(
    out.records.map((r) => [r.type, r.title, r.detail, r.href]),
    [
      ["offer", "Hares for the autumn fair", "Fair preview", "/offers/o1"],
      // Newest first. The fake has no row security; the real one hides the invoice from staff.
      ["document", "HARE-INV-7", "Document · Sale invoice", "/documents/d2"],
      ["document", "Hare certificate", "Document · Certificate · C-1", "/documents/d1"],
      ["shipment", "HARE-EXP", "Shipment · Export · 12 Sept 2026", "/shipments/s1"],
      ["piece_list", "Hare netsuke", "Inventory list", "/inventory/lists/pl1"],
      ["crm_list", "Hare collectors", "Contact list", "/crm/lists/cl1"],
      ["campaign", "Autumn", "Newsletter · The year of the hare", "/crm/campaigns/cc1"],
    ],
  );
});

test("records only from three characters, and the term is sanitised for the filter", async () => {
  search.setSearchConfigForTests(null);
  const two = db();
  const short = await palette.paletteSearch(two.client as never, "ha", ["admin"]);
  assert.deepEqual(short.records, []);
  assert.deepEqual(
    tablesRead(two).filter((t) => RECORD_TABLES.includes(t)),
    [],
  );
  // One Han character is searchable (works, makers, contacts) but is no record search.
  const kanji = db();
  await palette.paletteSearch(kanji.client as never, "兎", ["admin"]);
  assert.ok(rpcsCalled(kanji).includes("pieces_search"));
  assert.deepEqual(
    tablesRead(kanji).filter((t) => RECORD_TABLES.includes(t)),
    [],
  );
  // Commas and parentheses would add filter nodes to or(): stripped.
  const hostile = db();
  await palette.paletteSearch(hostile.client as never, "hare),id.eq.(x", ["admin"]);
  const or = hostile.calls.find((c: Req) => c.table === "crm_campaigns")?.filters.find((f) => f.kind === "or");
  assert.equal(or?.value, "name.ilike.%hare id.eq. x%,subject.ilike.%hare id.eq. x%");
});

test("too short or empty: an empty answer and no query at all", async () => {
  for (const q of ["", "   ", "a", "&&", null]) {
    const d = db();
    const out = await palette.paletteSearch(d.client as never, q, ["admin"]);
    assert.deepEqual(out, palette.emptyPalette());
    assert.equal(d.calls.length, 0, `no query for ${JSON.stringify(q)}`);
  }
  assert.equal(osRequests.length, 0);
});

test("a very long query is cut to 200 characters before anything is asked", async () => {
  search.setSearchConfigForTests(null);
  const d = db();
  await palette.paletteSearch(d.client as never, "hare ".repeat(100), ["admin"]);
  const rpc = d.calls.find((c: Req) => c.rpc === "pieces_search");
  assert.ok([...String(rpc?.args?.q)].length <= 200);
});

// ---------------------------------------------------------------- errors

test("one group failing never empties the others, and is named in failed", async () => {
  search.setSearchConfigForTests(null);
  const cases: [string, (req: Req) => boolean][] = [
    ["pieces", (req) => req.table === "vw_pieces_list"],
    ["pieces", (req) => req.rpc === "pieces_search"],
    ["makers", (req) => req.table === "makers"],
    ["contacts", (req) => req.rpc === "crm_contacts_search"],
    ["contacts", (req) => req.table === "crm_contacts"],
  ];
  for (const [failed, fail] of cases) {
    const out = await palette.paletteSearch(db({ fail }).client as never, "hare", ["admin"]);
    assert.deepEqual(out.failed, [failed]);
    assert.deepEqual(out[failed as "pieces" | "makers" | "contacts"], []);
    for (const other of ["pieces", "makers", "contacts"].filter((g) => g !== failed)) {
      assert.ok(out[other as "pieces"].length > 0, `${other} still answers when ${failed} fails`);
    }
    assert.ok(out.records.length > 0);
  }
});

test("a record table that fails: the other tables still answer, and records are marked failed", async () => {
  search.setSearchConfigForTests(null);
  const out = await palette.paletteSearch(db({ fail: (req) => req.table === "offers" }).client as never, "hare", ["staff"]);
  assert.deepEqual(out.failed, ["records"]);
  assert.ok(!out.records.some((r) => r.type === "offer"));
  assert.ok(out.records.some((r) => r.type === "campaign"));
  assert.ok(out.pieces.length > 0 && out.contacts.length > 0);
  // Every record table failing: the group is empty and failed, the rest unaffected.
  const all = await palette.paletteSearch(
    db({ fail: (req) => Boolean(req.table && RECORD_TABLES.includes(req.table)) }).client as never,
    "hare",
    ["staff"],
  );
  assert.deepEqual(all.failed, ["records"]);
  assert.deepEqual(all.records, []);
  assert.ok(all.pieces.length > 0);
});

test("OpenSearch down: exactly the Postgres answer, nothing reported failed", async () => {
  osAnswer = () => new Error("connect ECONNREFUSED");
  const out = await palette.paletteSearch(db().client as never, "hare", ["admin"]);
  assert.deepEqual(
    out.pieces.map((p) => p.id),
    [1, 2, 3].map(wid),
  );
  assert.equal(out.contacts.length, 2);
  assert.deepEqual(out.failed, []);
  assert.deepEqual(out.similar, { pieces: false, makers: false, contacts: false });
});

// ---------------------------------------------------------------- with OpenSearch

test("admin and staff: the engine's hits merged in, with the matched field's label", async () => {
  osAnswer = (kind) =>
    kind === "works"
      ? { strict: [[wid(7), ["provenance"]], [wid(2), ["title"]], wid(9)] }
      : kind === "contacts"
        ? { strict: [cid(3), cid(2)] }
        : {};
  for (const roles of [["admin"], ["staff"]]) {
    osRequests = [];
    // w9 was trashed after it was indexed: it does not load and is skipped.
    const d = db({ works: [1, 2], view: [1, 2, 7], contacts: [1, 2, 3] });
    const out = await palette.paletteSearch(d.client as never, "hare", roles);
    assert.deepEqual(
      out.pieces.map((p) => [p.id, p.matched]),
      [
        [wid(7), "provenance"],
        [wid(2), null],
        [wid(1), null],
      ],
    );
    assert.deepEqual(
      out.contacts.map((c) => c.id),
      [cid(3), cid(2), cid(1)],
    );
    const works = osRequests.find((r) => r.url.includes("-works-"));
    assert.equal(works?.body.size, 12);
    assert.ok("highlight" in (works?.body ?? {}), "the palette's twelve ask for highlights");
    assert.equal(osRequests.find((r) => r.url.includes("-contacts-"))?.body.size, 12);
    assert.equal(osRequests.find((r) => r.url.includes("-makers-"))?.body.size, 4);
  }
});

test("nothing matched exactly: the typo-tolerant pass's rows, marked similar per group", async () => {
  osAnswer = (kind) => (kind === "works" ? { strict: [], fuzzy: [wid(4)] } : kind === "contacts" ? { strict: [], fuzzy: [cid(5)] } : {});
  const d = fakeSupabase({
    tables: { vw_pieces_list: [work(4)], crm_contacts: [contact(5)], makers: [] },
    rpc: { pieces_search: () => [], crm_contacts_search: () => [] },
  });
  const out = await palette.paletteSearch(d.client as never, "hrae", ["staff"]);
  assert.deepEqual(
    out.pieces.map((p) => p.id),
    [wid(4)],
  );
  assert.deepEqual(
    out.contacts.map((c) => c.id),
    [cid(5)],
  );
  assert.deepEqual(out.similar, { pieces: true, makers: false, contacts: true });
  // Similar ids that no longer load: nothing shown, nothing labelled similar.
  osAnswer = (kind) => (kind === "works" ? { strict: [], fuzzy: [wid(8)] } : {});
  const gone = await palette.paletteSearch(d.client as never, "hrae", ["staff"]);
  assert.deepEqual(gone.pieces, []);
  assert.equal(gone.similar.pieces, false);
});
