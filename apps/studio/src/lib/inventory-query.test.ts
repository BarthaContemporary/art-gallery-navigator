// node --test apps/studio/src/lib/inventory-query.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the explicit extensions; the studio's tsconfig does not
// allow them (test files are not type-checked by the app).
// @ts-ignore TS5097
import "./test-support/alias.ts";
// @ts-ignore TS5097
import { fakeSupabase, type Row } from "./test-support/fake-supabase.ts";
// @ts-ignore -- plain JS test support
import { allowStudioImports } from "./opensearch/test-support.mjs";

// inventory-query imports lib/opensearch/search, whose own imports name
// their siblings without an extension, as the bundler allows.
allowStudioImports();
// @ts-ignore TS5097
const iq = await import("./inventory-query.ts");
const { PIECE_STATUS_ORDER, liveListGaps, loadInventoryExportRows, resolveInventory, selectInventoryPage, sortInventoryRows } = iq;
// @ts-ignore TS5097
const search = await import("./opensearch/search.ts");
// @ts-ignore TS5097
const { testSearchConfig } = await import("./opensearch/config.ts");
// @ts-ignore TS5097
const { resetCircuit } = await import("./opensearch/client.ts");

const ids = (rows: Row[]) => rows.map((r) => r.id);
/** The resolver as the page calls it, for a role that never reaches OpenSearch unless a test says otherwise. */
const resolveIds = async (client: unknown, params: URLSearchParams, order: { column: string; ascending: boolean } | null, roles: string[] = []) =>
  (await resolveInventory(client as never, params, order, { roles }))?.ids ?? null;

test("status sorts in the enum's order, as SQL sorts it, both ways", () => {
  const rows = ["sold", "in_stock", "written_off", "gifted", "reserved", "consigned_in", "returned", "consigned_out"].map(
    (status, i) => ({ id: `id${i}`, stock_number: `2026-000${i}`, status }),
  );
  const asc = sortInventoryRows([...rows], { column: "status", ascending: true }).map((r) => r.status);
  assert.deepEqual(asc, [...PIECE_STATUS_ORDER]);
  const desc = sortInventoryRows([...rows], { column: "status", ascending: false }).map((r) => r.status);
  assert.deepEqual(desc, [...PIECE_STATUS_ORDER].reverse());
});

test("equal keys fall back to the stock number in the same direction, then the id; nulls stay last", () => {
  const rows: Row[] = [
    { id: "b", stock_number: "2026-0002", maker_name: "Akiyama" },
    { id: "a", stock_number: "2026-0003", maker_name: null },
    { id: "d", stock_number: "2026-0001", maker_name: "akiyama" },
    { id: "c", stock_number: "2026-0002", maker_name: "Akiyama" },
    { id: "e", stock_number: "2026-0004", maker_name: "Zenzo" },
  ];
  assert.deepEqual(ids(sortInventoryRows([...rows], { column: "maker_name", ascending: true })), ["d", "b", "c", "e", "a"]);
  assert.deepEqual(ids(sortInventoryRows([...rows], { column: "maker_name", ascending: false })), ["e", "b", "c", "d", "a"]);
  // Whatever order the rows arrive in (chunks come back unordered).
  assert.deepEqual(
    ids(sortInventoryRows([...rows].reverse(), { column: "maker_name", ascending: true })),
    ["d", "b", "c", "e", "a"],
  );
});

/** A work as vw_pieces_list shows it. */
function work(n: number, over: Row = {}): Row {
  return {
    id: `w${String(n).padStart(4, "0")}`,
    stock_number: `2026-${String(n).padStart(4, "0")}`,
    title: `Work ${n}`,
    status: "in_stock",
    category_id: null,
    location_id: null,
    ledger: "jvb",
    web_visible: true,
    on_temp_export: false,
    needs_completion: false,
    missing_purchase_gbp: false,
    ...over,
  };
}

test("a list view sorted by status matches the plain view's order", async () => {
  const works = [
    work(1, { status: "sold" }),
    work(2, { status: "in_stock" }),
    work(3, { status: "consigned_in" }),
    work(4, { status: "in_stock" }),
    work(5, { status: "gifted" }),
  ];
  const { client, calls } = fakeSupabase({
    tables: {
      vw_pieces_list: works,
      piece_lists: [{ id: "L1", is_dynamic: false, filter_rules: null }],
      piece_list_items: works.map((w, i) => ({ list_id: "L1", piece_id: w.id, sort_order: i, excluded: false })),
    },
  });
  const params = new URLSearchParams({ list: "L1", sort: "status", dir: "asc" });
  const got = await resolveIds(client, params, { column: "status", ascending: true });
  // Available, Consigned in, Sold, Gifted: the enum's order, not the
  // alphabet's (which put consigned_in and gifted before in_stock). The two
  // Available works by stock number.
  assert.deepEqual(got, ["w0002", "w0004", "w0003", "w0001", "w0005"]);
  const read = calls.find((c) => c.table === "vw_pieces_list" && (c.columns ?? "").includes("status"));
  assert.ok(read && (read.columns ?? "").includes("stock_number"), "the tie-break column is read");
});

test("a search keeps its relevance order and asks only for the columns it needs", async () => {
  const hits = [work(7), work(2, { ledger: "external" }), work(5), work(9, { status: "sold" })];
  const { client, calls } = fakeSupabase({ rpc: { pieces_search: () => hits }, tables: { vw_pieces_list: hits } });
  const got = await resolveIds(client, new URLSearchParams({ q: "vase", status: "!sold" }), null);
  assert.deepEqual(got, ["w0007", "w0005"]);
  // The RPC returns whole stock rows otherwise: only what the merge reads.
  const rpc = calls.find((c) => c.rpc === "pieces_search");
  assert.equal(rpc?.columns, "id, stock_number, legacy_stock_number");
  // The facets and the register are the view's, in SQL; the id alone comes back while the search ranks.
  const view = calls.filter((c) => c.table === "vw_pieces_list");
  assert.equal(view.length, 1);
  assert.equal(view[0]?.columns, "id");
  assert.deepEqual(
    view[0]?.filters.filter((f) => f.kind !== "in").map((f) => [f.kind, f.column, f.value]),
    [
      ["neq", "status", "sold"],
      ["eq", "ledger", "jvb"],
    ],
  );
});

test("a failed list read is an error, not the whole stock", async () => {
  const { client } = fakeSupabase({
    tables: { vw_pieces_list: [work(1)] },
    fail: (req) => (req.table === "piece_lists" ? { message: "timeout" } : null),
  });
  await assert.rejects(resolveIds(client, new URLSearchParams({ list: "L1" }), null), /timeout/);
});

test("the plain view pages on a total order and survives a page past the end", async () => {
  const works = Array.from({ length: 5 }, (_, i) => work(i + 1, { status: i % 2 ? "sold" : "in_stock" }));
  works.push(work(6, { ledger: "external" }));
  const { client, calls } = fakeSupabase({ tables: { vw_pieces_list: works } });
  const order = { column: "status", ascending: true };

  const first = await selectInventoryPage<Row>(client, new URLSearchParams(), order, 0, 1);
  assert.equal(first.total, 5, "JvdB stock only by default");
  assert.deepEqual(ids(first.rows), ["w0001", "w0003"]);
  const paged = calls.at(-1);
  assert.deepEqual(
    paged?.orders.map((o) => [o.column, o.ascending]),
    [
      ["status", true],
      ["stock_number", true],
      ["id", true],
    ],
  );

  // An old ?page= link past the end: no error, the total alone.
  const past = await selectInventoryPage<Row>(client, new URLSearchParams(), order, 100, 199);
  assert.deepEqual(past, { rows: [], total: 5 });

  // Any other failure is still an error.
  const broken = fakeSupabase({ tables: { vw_pieces_list: works }, fail: () => ({ message: "boom" }) });
  await assert.rejects(selectInventoryPage(broken.client, new URLSearchParams(), order, 0, 1), /boom/);
});

test("an export of the plain view keeps the screen's tie-break", async () => {
  const works = [work(1, { status: "sold" }), work(2), work(3, { status: "sold" }), work(4)];
  const { client } = fakeSupabase({ tables: { vw_pieces_list: works } });
  const rows = await loadInventoryExportRows(client, new URLSearchParams({ sort: "status", dir: "desc" }), { roles: [] });
  assert.deepEqual(ids(rows), ["w0003", "w0001", "w0004", "w0002"]);
});

test("an export of the plain view reads every row, a page at a time on a total order", async () => {
  // More than one PostgREST page (1,000 rows): one read would stop at the cap.
  const works = Array.from({ length: 1050 }, (_, i) => work(i + 1));
  const { client, calls } = fakeSupabase({ tables: { vw_pieces_list: works } });
  const rows = await loadInventoryExportRows(client, new URLSearchParams(), { roles: [] });
  assert.equal(rows.length, 1050);
  assert.deepEqual(ids(rows).slice(0, 2), ["w0001", "w0002"], "oldest stock number first, as the exports read");
  const pages = calls.filter((c) => c.table === "vw_pieces_list");
  assert.deepEqual(
    pages.map((c) => c.range),
    [
      [0, 999],
      [1000, 1999],
      [1050, 2049],
    ],
  );
  for (const page of pages) {
    assert.deepEqual(page.orders.map((o) => o.column), ["stock_number", "id"], "the id makes the order total");
  }
});

// ------------------------------------------------------------------ the search, with OpenSearch beside Postgres

const cfg = testSearchConfig("http://127.0.0.1:1", "oslib-inventory");
type Body = Record<string, unknown>;
const isFuzzy = (b: Body) => JSON.stringify(b).includes("fuzziness");
const osHits = (...hitIds: string[]) => ({ hits: { hits: hitIds.map((id) => ({ _id: id })) } });

/**
 * OpenSearch configured (a test prefix) and answering through a fake fetch:
 * `answer` gets each request's body; the requests are recorded.
 */
function withOpenSearch(answer: (body: Body) => unknown) {
  const requests: Body[] = [];
  const realFetch = globalThis.fetch;
  const realError = console.error;
  resetCircuit();
  search.setSearchConfigForTests(cfg);
  console.error = () => {};
  globalThis.fetch = (async (_input: string | URL, init: RequestInit = {}) => {
    const body = JSON.parse(String(init.body ?? "{}")) as Body;
    requests.push(body);
    return new Response(JSON.stringify(answer(body)), { status: 200 });
  }) as typeof fetch;
  return {
    requests,
    restore() {
      globalThis.fetch = realFetch;
      console.error = realError;
      search.setSearchConfigForTests(undefined);
    },
  };
}

/** A stock with a few works the index knows and Postgres does not match. */
function stock() {
  return [
    work(1, { title: "Tea bowl" }),
    work(2, { title: "Vase" }),
    work(3, { title: "Incense burner", status: "sold" }),
    work(4, { title: "Netsuke", ledger: "external" }),
    work(5, { title: "Bronze vase", web_visible: false }),
    work(6, { title: "Ink stone" }),
  ];
}

test("staff: OpenSearch's ids are merged after the stock-number match and checked against the view, in order", async () => {
  const works = stock();
  const os = withOpenSearch((b) => (isFuzzy(b) ? osHits() : osHits("w0006", "not-a-work", "w0002", "w0001")));
  try {
    const { client } = fakeSupabase({
      // Postgres finds the exact stock number and one title.
      rpc: { pieces_search: () => [works[1]!, works[0]!] },
      tables: { vw_pieces_list: works },
    });
    const got = await resolveInventory(client as never, new URLSearchParams({ q: "2026-0002" }), null, { roles: ["staff"] });
    // 2026-0002 leads (exact stock number), then OpenSearch's order, then the
    // rest of Postgres; the id the view does not hold (not a work, the trash,
    // a row the user may not read) is dropped.
    assert.deepEqual(got, { ids: ["w0002", "w0006", "w0001"], similar: false });
    assert.equal(os.requests.length, 1, "something matched: no typo-tolerant pass");
    assert.equal(os.requests[0]!.size, 10_000, "every match, not a page: the page counts and pages them");
  } finally {
    os.restore();
  }
});

test("the URL's filters apply to OpenSearch's ids as to Postgres's, in SQL", async () => {
  const works = stock();
  const os = withOpenSearch(() => osHits("w0003", "w0004", "w0005", "w0006"));
  try {
    const { client, calls } = fakeSupabase({ rpc: { pieces_search: () => [] }, tables: { vw_pieces_list: works } });
    const roles = ["admin"];
    // JvdB stock by default: the non-JvdB work w0004 is not shown.
    let got = await resolveInventory(client as never, new URLSearchParams({ q: "burner" }), null, { roles });
    assert.deepEqual(got?.ids, ["w0003", "w0005", "w0006"]);
    // Not sold, not on the website.
    got = await resolveInventory(client as never, new URLSearchParams({ q: "burner", status: "!sold", web: "off" }), null, { roles });
    assert.deepEqual(got?.ids, ["w0005"]);
    // Both registers, sorted by title: the chosen column wins over the ranking.
    got = await resolveInventory(
      client as never,
      new URLSearchParams({ q: "burner", ledger: "all", sort: "title" }),
      { column: "title", ascending: true },
      { roles },
    );
    assert.deepEqual(got?.ids, ["w0005", "w0003", "w0006", "w0004"]);
    const sorted = calls.filter((c) => c.table === "vw_pieces_list").at(-1);
    assert.equal(sorted?.columns, "id, stock_number, title");
    // A list narrows the merged ids too.
    const listed = fakeSupabase({
      rpc: { pieces_search: () => [] },
      tables: {
        vw_pieces_list: works,
        piece_lists: [{ id: "L1", is_dynamic: false, filter_rules: null }],
        piece_list_items: [{ list_id: "L1", piece_id: "w0006", sort_order: 0, excluded: false }],
      },
    });
    got = await resolveInventory(listed.client as never, new URLSearchParams({ q: "burner", list: "L1" }), null, { roles });
    assert.deepEqual(got?.ids, ["w0006"]);
  } finally {
    os.restore();
  }
});

test("many merged ids are read in chunks the gateway accepts, every one, in order", async () => {
  const works = Array.from({ length: 250 }, (_, i) => work(i + 1));
  const ranked = [...works].reverse().map((w) => w.id as string);
  const os = withOpenSearch(() => osHits(...ranked));
  try {
    const { client, calls } = fakeSupabase({ rpc: { pieces_search: () => [] }, tables: { vw_pieces_list: works } });
    const params = new URLSearchParams({ q: "tea" });
    const got = await resolveInventory(client as never, params, null, { roles: ["staff"] });
    assert.deepEqual(got?.ids, ranked);
    const chunks = calls.filter((c) => c.table === "vw_pieces_list").map((c) => (c.filters.find((f) => f.kind === "in")?.value as string[]).length);
    assert.deepEqual(chunks, [100, 100, 50]);
    // The export takes every one of them too, in the same order.
    const rows = await loadInventoryExportRows(client as never, params, { roles: ["staff"] });
    assert.deepEqual(ids(rows), ranked);
  } finally {
    os.restore();
  }
});

test("nothing exact: the typo-tolerant pass answers, flagged similar; never when the filters leave nothing", async () => {
  const works = stock();
  const os = withOpenSearch((b) => (isFuzzy(b) ? osHits("w0002", "w0005") : osHits()));
  try {
    const { client } = fakeSupabase({ rpc: { pieces_search: () => [] }, tables: { vw_pieces_list: works } });
    let got = await resolveInventory(client as never, new URLSearchParams({ q: "vsae" }), null, { roles: ["staff"] });
    assert.deepEqual(got, { ids: ["w0002", "w0005"], similar: true });
    assert.equal(os.requests.length, 2);
    // Similar works the filters then remove: an empty answer, not a "similar" banner over nothing.
    got = await resolveInventory(client as never, new URLSearchParams({ q: "vsae", status: "sold" }), null, { roles: ["staff"] });
    assert.deepEqual(got, { ids: [], similar: false });
  } finally {
    os.restore();
  }
});

test("Postgres only, exactly as before, when OpenSearch is not configured or the role may not use it", async () => {
  const works = stock();
  const rpc = () => [works[5]!, works[3]!, works[1]!, works[2]!];
  const params = new URLSearchParams({ q: "ink", status: "!sold" });
  // Not configured (the live studio has no OPENSEARCH_* variables).
  const os = withOpenSearch(() => osHits("w0001"));
  try {
    search.setSearchConfigForTests(null);
    const { client } = fakeSupabase({ rpc: { pieces_search: rpc }, tables: { vw_pieces_list: works } });
    assert.deepEqual(await resolveInventory(client as never, params, null, { roles: ["admin"] }), { ids: ["w0006", "w0002"], similar: false });
    // Configured, but the accountant and users with no role never reach it.
    search.setSearchConfigForTests(cfg);
    for (const roles of [["accountant"], []]) {
      assert.deepEqual(await resolveInventory(client as never, params, null, { roles }), { ids: ["w0006", "w0002"], similar: false });
    }
    assert.equal(os.requests.length, 0);
  } finally {
    os.restore();
  }
});

test("OpenSearch down: Postgres's answer stands; a Postgres error is an error", async () => {
  const works = stock();
  const realFetch = globalThis.fetch;
  const os = withOpenSearch(() => ({}));
  globalThis.fetch = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  try {
    const { client } = fakeSupabase({ rpc: { pieces_search: () => [works[1]!] }, tables: { vw_pieces_list: works } });
    assert.deepEqual(await resolveInventory(client as never, new URLSearchParams({ q: "vase" }), null, { roles: ["staff"] }), {
      ids: ["w0002"],
      similar: false,
    });
    const broken = fakeSupabase({ rpc: { pieces_search: () => [] }, fail: (req) => (req.rpc ? { message: "statement timeout" } : null) });
    await assert.rejects(resolveInventory(broken.client as never, new URLSearchParams({ q: "vase" }), null, { roles: ["staff"] }), /statement timeout/);
  } finally {
    os.restore();
    globalThis.fetch = realFetch;
  }
});

test("the save form names what a live list will not hold, a similar result among them", () => {
  assert.deepEqual(liveListGaps({}), []);
  assert.deepEqual(liveListGaps({}, { similar: false }), []);
  assert.deepEqual(liveListGaps({ needs: "1", flagged: "1", list: "l1", web: "off" }), [
    "Needs completion",
    "Flagged only",
    "List filter",
    "Website filter",
  ]);
  // A live list re-runs rules.q through pieces_search alone, which found
  // nothing exact, so the similar works on screen are not what it holds.
  assert.deepEqual(liveListGaps({ web: "any" }, { similar: true }), [
    "Similar matches (a live list re-runs the exact search)",
  ]);
  assert.deepEqual(liveListGaps({ loan: "1" }, { similar: true }), [
    "On temporary export",
    "Similar matches (a live list re-runs the exact search)",
  ]);
});
