// node --test apps/studio/src/lib/list-members.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the explicit extensions; the studio's tsconfig does not
// allow them (test files are not type-checked by the app).
// @ts-ignore TS5097
import "./test-support/alias.ts";
// @ts-ignore TS5097
import { fakeSupabase, type Row } from "./test-support/fake-supabase.ts";

// @ts-ignore TS5097
const lm = await import("./list-members.ts");
const {
  countListMembers,
  ledgerFilterOf,
  ledgerRuleLabel,
  listSize,
  LIVE_LIMIT,
  liveCapHeadline,
  liveCapNotice,
  liveCapSaveHint,
  liveListOrder,
  resolveListMembership,
  resolveListPieceIds,
} = lm;

/** A work as vw_pieces_list shows it (a trashed work is simply not there). */
function work(n: number, over: Row = {}): Row {
  return {
    id: `w${String(n).padStart(4, "0")}`,
    stock_number: `2026-${String(n).padStart(4, "0")}`,
    title: `Work ${n}`,
    status: "in_stock",
    category_id: null,
    location_id: null,
    ledger: "jvb",
    framed: false,
    web_visible: true,
    description: "a long description the list never needs",
    ...over,
  };
}

const STATIC = { id: "L1", is_dynamic: false, filter_rules: null };

test("a static list keeps its hand-set order and leaves out works in the trash", async () => {
  const { client } = fakeSupabase({
    tables: {
      // w0003 is in the trash: its list row stays (restoring brings it back), the view drops it.
      vw_pieces_list: [work(1), work(2, { web_visible: false }), work(4)],
      piece_list_items: [
        { list_id: "L1", piece_id: "w0004", sort_order: 0, excluded: false },
        { list_id: "L1", piece_id: "w0003", sort_order: 1, excluded: false },
        { list_id: "L1", piece_id: "w0001", sort_order: 2, excluded: false },
        { list_id: "L1", piece_id: "w0002", sort_order: 3, excluded: false },
        { list_id: "L2", piece_id: "w0002", sort_order: 0, excluded: false },
      ],
    },
  });
  assert.deepEqual(await resolveListPieceIds(client, STATIC), ["w0004", "w0001", "w0002"]);
  assert.deepEqual(await resolveListPieceIds(client, STATIC, { webVisibleOnly: true }), ["w0004", "w0001"]);
  assert.deepEqual(await listSize(client, STATIC), { shown: 3, total: 3 });
  // The embedded row count (4, the trashed work included) is no longer believed.
  assert.equal(await countListMembers(client, { ...STATIC, piece_list_items: [{ count: 4 }] }), 3);
});

test("a failed read throws instead of answering with an empty list", async () => {
  const items = [{ list_id: "L1", piece_id: "w0001", sort_order: 0, excluded: false }];
  for (const table of ["piece_list_items", "vw_pieces_list"]) {
    const { client } = fakeSupabase({
      tables: { vw_pieces_list: [work(1)], piece_list_items: items },
      fail: (req) => (req.table === table ? { message: `${table} timed out` } : null),
    });
    await assert.rejects(resolveListPieceIds(client, STATIC), /timed out/);
    // The count says "unknown" rather than 0.
    assert.equal(await countListMembers(client, STATIC), null);
  }
});

test("a live list's exclusions, search and query failures all throw", async () => {
  const live = { id: "L9", is_dynamic: true, filter_rules: { status: "in_stock" } };
  const text = { id: "L9", is_dynamic: true, filter_rules: { q: "vase" } };
  const cases: [Row, (req: { table: string | null; rpc: string | null; filters: { column: string; value: unknown }[] }) => boolean][] = [
    // The exclusions read: an empty set would bring pinned-out works back.
    [live, (req) => req.table === "piece_list_items" && req.filters.some((f) => f.column === "excluded" && f.value === true)],
    [live, (req) => req.table === "vw_pieces_list"],
    [text, (req) => req.rpc === "pieces_search"],
  ];
  for (const [list, which] of cases) {
    const { client } = fakeSupabase({
      tables: { vw_pieces_list: [work(1)], piece_list_items: [] },
      rpc: { pieces_search: () => [work(1, { title: "vase" })] },
      fail: (req) => (which(req) ? { message: "upstream 503" } : null),
    });
    await assert.rejects(resolveListPieceIds(client, list as never), /503/);
  }
});

test("a live list takes pinned-out works away before the cap, and says how many it matched", async () => {
  const works = Array.from({ length: 600 }, (_, i) => work(i + 1));
  // The two newest are pinned out.
  const pins = [
    { list_id: "L5", piece_id: "w0600", excluded: true },
    { list_id: "L5", piece_id: "w0599", excluded: true },
  ];
  const { client } = fakeSupabase({ tables: { vw_pieces_list: works, piece_list_items: pins } });
  const list = { id: "L5", is_dynamic: true, filter_rules: { status: "!sold" } };
  const m = await resolveListMembership(client, list);
  assert.equal(m.ids.length, LIVE_LIMIT);
  assert.equal(m.ids[0], "w0598");
  assert.ok(!m.ids.includes("w0600") && !m.ids.includes("w0599"));
  assert.equal(m.total, 598);
  // The ids alone are the same, newest first.
  assert.deepEqual(await resolveListPieceIds(client, list), m.ids);
  assert.deepEqual(await listSize(client, list), { shown: 500, total: 598 });

  // Without pins the cheap head count still caps what is shown.
  const plain = { id: "L6", is_dynamic: true, filter_rules: {} };
  assert.deepEqual(await listSize(client, plain), { shown: 500, total: 600 });
  assert.equal(await countListMembers(client, plain), 500);
});

test("the register rule reads the same everywhere", async () => {
  assert.equal(ledgerFilterOf(undefined), "jvb");
  assert.equal(ledgerFilterOf(""), "jvb");
  assert.equal(ledgerFilterOf("jvb"), "jvb");
  assert.equal(ledgerFilterOf("external"), "external");
  assert.equal(ledgerFilterOf("all"), null);
  assert.equal(ledgerRuleLabel(null), null);
  assert.equal(ledgerRuleLabel("external"), "not JvdB");
  assert.equal(ledgerRuleLabel("all"), "both registers");

  const { client } = fakeSupabase({
    tables: {
      vw_pieces_list: [work(1), work(2, { ledger: "external" }), work(3)],
      piece_list_items: [],
    },
  });
  const ids = (ledger: string | null) =>
    resolveListPieceIds(client, { id: "L7", is_dynamic: true, filter_rules: { ledger } });
  assert.deepEqual(await ids(null), ["w0003", "w0001"]);
  assert.deepEqual(await ids("external"), ["w0002"]);
  assert.deepEqual(await ids("all"), ["w0003", "w0002", "w0001"]);
});

test("a text rule asks the search for the columns it filters on, framed and web_visible included", async () => {
  const hits = [
    work(5, { title: "vase", framed: true, web_visible: false }),
    work(3, { title: "vase", framed: true }),
    work(9, { title: "vase", framed: false }),
    work(7, { title: "vase", framed: true, ledger: "external" }),
  ];
  const { client, calls } = fakeSupabase({
    tables: { piece_list_items: [{ list_id: "L8", piece_id: "w0003", excluded: true }] },
    rpc: { pieces_search: () => hits },
  });
  const framed = { id: "L8", is_dynamic: true, filter_rules: { q: "vase", framed: true } };
  // Rank order kept; the pinned-out w0003 and the external w0007 left out.
  assert.deepEqual(await resolveListPieceIds(client, framed), ["w0005"]);
  assert.deepEqual(await resolveListPieceIds(client, framed, { webVisibleOnly: true }), []);
  const search = calls.find((c) => c.rpc === "pieces_search");
  assert.ok(search);
  const cols = (search.columns ?? "").split(",").map((s) => s.trim());
  for (const c of ["id", "status", "category_id", "location_id", "ledger", "framed", "web_visible"]) {
    assert.ok(cols.includes(c), `${c} selected`);
  }
  assert.ok(!cols.includes("*") && !cols.includes("description"));
});

test("a search list cut at the cap keeps its best matches and says so; a facet list says oldest", async () => {
  // pieces_search answers in relevance order, which here runs OLDEST stock
  // number first: the cap must keep the best matches, not the newest works.
  const hits = Array.from({ length: 520 }, (_, i) => work(i + 1, { title: "vase" }));
  const { client } = fakeSupabase({ tables: { piece_list_items: [] }, rpc: { pieces_search: () => hits } });
  const search = { id: "L9", is_dynamic: true, filter_rules: { q: "vase" } };
  const m = await resolveListMembership(client, search);
  assert.equal(m.total, 520);
  assert.equal(m.ids.length, LIVE_LIMIT);
  assert.equal(m.ids[0], "w0001");
  assert.ok(!m.ids.includes("w0520"), "the weakest match is the one cut");

  assert.equal(liveListOrder(search.filter_rules), "relevance");
  assert.equal(liveListOrder({ q: "   ", status: "!sold" }), "stock");
  assert.equal(liveListOrder(null), "stock");

  assert.equal(liveCapHeadline(search.filter_rules, 500, 812), "The 500 best matches of 812");
  assert.equal(liveCapHeadline({ status: "!sold" }, 500, 1203), "Newest 500 of 1,203 works");

  const searchNotice = liveCapNotice(search.filter_rules, 500, 800);
  assert.match(searchNotice, /The 300 weakest matches are left out/);
  assert.doesNotMatch(searchNotice, /oldest|newest/);
  const facetNotice = liveCapNotice({ category: "c1" }, 500, 800);
  assert.match(facetNotice, /The 300 with the oldest stock numbers are left out/);
  assert.doesNotMatch(facetNotice, /weakest|best/);

  assert.equal(liveCapSaveHint({ q: "Japan" }), "holds the 500 best matches for the search");
  assert.equal(liveCapSaveHint({ q: undefined }), "holds the newest 500 works they match");
  assert.equal(liveCapSaveHint({ q: "" }), "holds the newest 500 works they match");
});
