// node --test apps/studio/src/lib/palette-rows.test.ts
// The palette's rows from /api/search's answer: order, labels, links, the
// "All … matching" rows, "Similar matches" and the failure line.
import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore -- plain JS test support
import { allowStudioImports } from "./opensearch/test-support.mjs";

allowStudioImports();
type RowsModule = typeof import("./palette-rows");
type SearchModule = typeof import("./palette-search");
// @ts-ignore TS5097
const rowsModule = (await import("./palette-rows.ts")) as RowsModule;
const { paletteRows, isSimilar, failedText } = rowsModule;
type Answer = ReturnType<SearchModule["emptyPalette"]>;

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/inventory", label: "Inventory" },
  { href: "/crm/contacts", label: "Contacts" },
];

function answer(over: Partial<Answer> = {}): Answer {
  return {
    pieces: [],
    makers: [],
    contacts: [],
    records: [],
    similar: { pieces: false, makers: false, contacts: false },
    failed: [],
    ...over,
  };
}
const piece = (n: number, matched: string | null = null) => ({
  id: `w${n}`,
  stock_number: `2026-000${n}`,
  title: `Hare ${n}`,
  maker_name: "Masanao",
  status: "in_stock",
  matched,
});

test("before any answer: the pages whose label holds the query", () => {
  assert.deepEqual(
    paletteRows(NAV, "", null).map((r) => r.href),
    ["/", "/inventory", "/crm/contacts"],
  );
  assert.deepEqual(
    paletteRows(NAV, "cont", null).map((r) => [r.group, r.label]),
    [["page", "Contacts"]],
  );
});

test("groups in order: pages, works and their 'All works' row, makers, contacts and theirs, records", () => {
  const rows = paletteRows(
    NAV,
    "inv hare",
    answer({
      pieces: [piece(1, "provenance"), piece(2)],
      makers: [{ id: "m1", name: "Masanao", detail: "正直 · Japan" }],
      contacts: [{ id: "c1", name: "Lucy Hare", email: null }],
      records: [{ type: "offer", id: "o1", href: "/offers/o1", title: "Hares", detail: "Offer" }],
    }),
  );
  assert.deepEqual(
    rows.map((r) => [r.group, r.label, r.href]),
    [
      ["piece", "Hare 1", "/inventory/2026-0001"],
      ["piece", "Hare 2", "/inventory/2026-0002"],
      ["piece", "All works matching “inv hare”", "/inventory?q=inv%20hare"],
      ["maker", "Masanao", "/makers/m1"],
      ["contact", "Lucy Hare", "/crm/contacts/c1"],
      ["contact", "All contacts matching “inv hare”", "/crm/contacts?q=inv%20hare"],
      ["record", "Hares", "/offers/o1"],
    ],
  );
  assert.equal(rows[0]!.sub, "2026-0001 · Masanao · Available");
  assert.equal(rows[0]!.note, "Matched in provenance");
  assert.equal(rows[1]!.note, undefined);
  assert.equal(rows[2]!.more, true);
  assert.equal(rows[4]!.sub, "Contact", "no email: the word, not a blank");
  assert.equal(new Set(rows.map((r) => r.key)).size, rows.length, "keys are unique");
});

test("no contacts (the accountant, or none matched): no 'All contacts' row; no works, no 'All works' row", () => {
  const rows = paletteRows(NAV, "hare", answer({ makers: [{ id: "m1", name: "Masanao", detail: null }] }));
  assert.deepEqual(
    rows.map((r) => r.key),
    ["maker:m1"],
  );
  assert.equal(rows[0]!.sub, "Maker");
});

test("a group that failed keeps its 'All … matching' row, the way to try the full search", () => {
  const rows = paletteRows(NAV, "hare", answer({ failed: ["pieces", "contacts"] }));
  assert.deepEqual(
    rows.map((r) => r.key),
    ["more:pieces", "more:contacts"],
  );
});

test("the query in the links is encoded, and a long one is cut in the label only", () => {
  const long = "a&b=c ".repeat(12).trim();
  const rows = paletteRows([], long, answer({ pieces: [piece(1)] }));
  const more = rows.find((r) => r.more)!;
  assert.equal(more.href, `/inventory?q=${encodeURIComponent(long)}`);
  assert.ok(more.label.endsWith("…”"));
  assert.equal(more.label, `All works matching “${long.slice(0, 39)}…”`);
});

test("a work with no title shows its stock number; a record link off the site is dropped", () => {
  const rows = paletteRows(
    [],
    "hare",
    answer({
      pieces: [{ ...piece(1), title: "  " }],
      records: [
        { type: "offer", id: "x", href: "//evil.example/x", title: "Bad", detail: "Offer" },
        { type: "offer", id: "y", href: "https://evil.example/y", title: "Bad", detail: "Offer" },
        { type: "crm_list", id: "z", href: "/crm/lists/z", title: "Good", detail: "Contact list" },
      ],
    }),
  );
  assert.equal(rows[0]!.label, "2026-0001");
  assert.deepEqual(
    rows.filter((r) => r.group === "record").map((r) => r.label),
    ["Good"],
  );
});

test("similar matches are per group", () => {
  const a = answer({ similar: { pieces: true, makers: false, contacts: true } });
  assert.equal(isSimilar("piece", a), true);
  assert.equal(isSimilar("maker", a), false);
  assert.equal(isSimilar("contact", a), true);
  assert.equal(isSimilar("record", a), false);
  assert.equal(isSimilar("page", a), false);
  assert.equal(isSimilar("piece", null), false);
});

test("the failure line names what could not be searched", () => {
  assert.equal(failedText([]), null);
  assert.equal(failedText(["contacts"]), "Couldn’t search contacts. Try again in a moment.");
  assert.equal(failedText(["pieces", "records"]), "Couldn’t search works and records. Try again in a moment.");
  assert.equal(
    failedText(["pieces", "makers", "contacts", "records"]),
    "Couldn’t search works, makers, contacts and records. Try again in a moment.",
  );
});
