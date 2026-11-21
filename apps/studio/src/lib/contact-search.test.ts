// node --test apps/studio/src/lib/contact-search.test.ts
// Contact searches outside the palette (the contacts page, a list's add box,
// /api/crm/contacts/search) over an in-memory Supabase and a fake
// OpenSearch: today's result without the index, the merge and the roles with
// it, exclusions, rows that do not load, the truthful "may be more", the
// page past the end, and the pickers' route answer.
import { test, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore -- plain JS test support
import { allowStudioImports } from "./opensearch/test-support.mjs";
// @ts-ignore TS5097
import { fakeSupabase, type Row, type Req } from "./test-support/fake-supabase.ts";
// @ts-ignore TS5097
import { testSearchConfig } from "./opensearch/config.ts";
// @ts-ignore TS5097
import { resetCircuit } from "./opensearch/client.ts";

allowStudioImports();
type ContactSearchModule = typeof import("./contact-search");
type SearchModule = typeof import("./opensearch/search");
let cs: ContactSearchModule;
let search: SearchModule;
before(async () => {
  // @ts-ignore TS5097
  cs = (await import("./contact-search.ts")) as ContactSearchModule;
  // @ts-ignore TS5097
  search = (await import("./opensearch/search.ts")) as SearchModule;
});

const cfg = testSearchConfig("http://127.0.0.1:1", "oslib-contacts");
type Body = Record<string, unknown>;
let osRequests: { url: string; body: Body }[] = [];
let osAnswer: { strict?: string[]; fuzzy?: string[] } | Error = {};
const realFetch = globalThis.fetch;
const realError = console.error;

beforeEach(() => {
  osRequests = [];
  osAnswer = {};
  resetCircuit();
  search.setSearchConfigForTests(cfg);
  console.error = () => {};
  globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => {
    const body = JSON.parse(String(init.body ?? "{}")) as Body;
    osRequests.push({ url: String(input), body });
    if (osAnswer instanceof Error) throw osAnswer;
    const fuzzy = JSON.stringify(body).includes("fuzziness");
    const ids = (fuzzy ? osAnswer.fuzzy : osAnswer.strict) ?? [];
    return new Response(JSON.stringify({ hits: { hits: ids.map((_id) => ({ _id })) } }), { status: 200 });
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  console.error = realError;
  search.setSearchConfigForTests(undefined);
});

const cid = (n: number) => `c${String(n).padStart(3, "0")}`;
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const contact = (n: number): Row => ({
  id: cid(n),
  first_name: "Lucy",
  last_name: `Hare ${String(n).padStart(3, "0")}`,
  email: n % 2 ? `lucy${n}@example.com` : null,
});

/** crm_contacts_search ranks `ranked` (it stops at 100, as the function does); crm_contacts holds `stored` (default: the ranked ones). */
function contactsDb(ranked: number[], opts: { stored?: number[]; fail?: (req: Req) => boolean } = {}) {
  return fakeSupabase({
    tables: { crm_contacts: (opts.stored ?? ranked).map(contact) },
    rpc: { crm_contacts_search: () => ranked.slice(0, 100).map(contact) },
    fail: (req) => (opts.fail?.(req) ? { message: "statement timeout", code: "57014" } : null),
  });
}
const COLS = "id, first_name, last_name, email";
const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

// ---------------------------------------------------------------- findContacts

test("without the index: crm_contacts_search's order, rows from crm_contacts, nothing sent to OpenSearch", async () => {
  search.setSearchConfigForTests(null);
  const d = contactsDb([3, 1, 2]);
  const out = await cs.findContacts<{ id: string }>(d.client as never, "lucy", { roles: ["admin"], columns: COLS, limit: 200 });
  assert.equal(out.error, null);
  assert.equal(out.similar, false);
  assert.equal(out.found, 3);
  assert.deepEqual(ids(out.rows), [cid(3), cid(1), cid(2)]);
  assert.deepEqual(Object.keys(out.rows[0]!).sort(), ["email", "first_name", "id", "last_name"]);
  assert.equal(osRequests.length, 0);
  assert.deepEqual(d.calls.find((c: Req) => c.rpc)?.args, { q: "lucy" });
});

test("the accountant and users with no role never reach the index", async () => {
  osAnswer = { strict: [cid(9)] };
  for (const roles of [["accountant"], []]) {
    const d = contactsDb([1, 2], { stored: [1, 2, 9] });
    const out = await cs.findContacts<{ id: string }>(d.client as never, "lucy", { roles, columns: COLS, limit: 200 });
    assert.deepEqual(ids(out.rows), [cid(1), cid(2)]);
  }
  assert.equal(osRequests.length, 0);
});

test("admin and staff: the index's hits first, an id that does not load dropped", async () => {
  // Index: c9 (erased since it was indexed), c5, c2. Postgres: c1, c2.
  osAnswer = { strict: [cid(9), cid(5), cid(2)] };
  for (const roles of [["admin"], ["staff"]]) {
    osRequests = [];
    const d = contactsDb([1, 2], { stored: [1, 2, 5] });
    const out = await cs.findContacts<{ id: string }>(d.client as never, "lucy", { roles, columns: COLS, limit: 200 });
    assert.deepEqual(ids(out.rows), [cid(5), cid(2), cid(1)]);
    assert.equal(out.found, 4);
    assert.equal(osRequests.length, 1);
    assert.equal(osRequests[0]!.body.size, 200);
    assert.ok(osRequests[0]!.url.includes("oslib-contacts-contacts-v"));
  }
});

test("a list's add box: 100 asked for, members taken out before the first 20 are kept", async () => {
  osAnswer = { strict: [] };
  // The 30 best matches are already members.
  const d = contactsDb(range(1, 100));
  const members = new Set(range(1, 30).map(cid));
  const out = await cs.findContacts<{ id: string }>(d.client as never, "lucy", {
    roles: ["staff"],
    columns: COLS,
    limit: cs.LIST_ADD_ASK,
    exclude: members,
    show: cs.LIST_ADD_SHOW,
  });
  assert.deepEqual(ids(out.rows), range(31, 50).map(cid));
  assert.equal(osRequests[0]!.body.size, 100);
  // Members are never loaded, and no request carries more than 100 ids.
  const loads = d.calls.filter((c: Req) => c.table === "crm_contacts");
  for (const l of loads) {
    const asked = l.filters.find((f) => f.kind === "in")?.value as string[];
    assert.ok(asked.length <= 100);
    assert.ok(!asked.some((id) => members.has(id)));
  }
});

test("nothing matched exactly: the typo-tolerant pass's contacts, marked similar", async () => {
  osAnswer = { strict: [], fuzzy: [cid(4)] };
  const d = contactsDb([], { stored: [4] });
  const out = await cs.findContacts<{ id: string }>(d.client as never, "lcuy", { roles: ["staff"], columns: COLS, limit: 200 });
  assert.equal(out.similar, true);
  assert.deepEqual(ids(out.rows), [cid(4)]);
  // Similar contacts that are all excluded: nothing shown, nothing labelled.
  const none = await cs.findContacts<{ id: string }>(contactsDb([], { stored: [4] }).client as never, "lcuy", {
    roles: ["staff"],
    columns: COLS,
    limit: 200,
    exclude: new Set([cid(4)]),
  });
  assert.deepEqual(none.rows, []);
  assert.equal(none.similar, false);
});

test("the index down: exactly today's result", async () => {
  osAnswer = new Error("connect ECONNREFUSED");
  const out = await cs.findContacts<{ id: string }>(contactsDb([2, 1]).client as never, "lucy", {
    roles: ["admin"],
    columns: COLS,
    limit: 200,
  });
  assert.deepEqual(ids(out.rows), [cid(2), cid(1)]);
  assert.equal(out.error, null);
});

test("errors are returned, never thrown, with no rows", async () => {
  search.setSearchConfigForTests(null);
  const rpc = await cs.findContacts(contactsDb([1], { fail: (r) => r.rpc === "crm_contacts_search" }).client as never, "lucy", {
    roles: ["admin"],
    columns: COLS,
    limit: 200,
  });
  assert.equal(rpc.error?.message, "statement timeout");
  assert.deepEqual(rpc.rows, []);
  const load = await cs.findContacts(contactsDb([1], { fail: (r) => r.table === "crm_contacts" }).client as never, "lucy", {
    roles: ["admin"],
    columns: COLS,
    limit: 200,
  });
  assert.equal(load.error?.message, "statement timeout");
  assert.deepEqual(load.rows, []);
});

test("the pages search any term, one letter included, as before the index; an empty one is no query", async () => {
  for (const q of ["", "   "]) {
    const d = contactsDb([1]);
    const out = await cs.findContacts(d.client as never, q, { roles: ["admin"], columns: COLS, limit: 200 });
    assert.deepEqual(out.rows, []);
    assert.equal(d.calls.length, 0);
  }
  search.setSearchConfigForTests(null);
  for (const q of ["l", "林"]) {
    const d = contactsDb([1]);
    const out = await cs.findContacts<{ id: string }>(d.client as never, q, { roles: ["admin"], columns: COLS, limit: 200 });
    assert.deepEqual(ids(out.rows), [cid(1)]);
  }
});

// ---------------------------------------------------------------- "may be more"

test("may be more: when Postgres's own 100 was reached, or the limit asked for", () => {
  // The contacts page asks for 200: 100 can be crm_contacts_search's cut, 99 cannot.
  assert.equal(cs.mayHaveMore(99, cs.CONTACTS_PAGE_LIMIT), false);
  assert.equal(cs.mayHaveMore(100, cs.CONTACTS_PAGE_LIMIT), true);
  assert.equal(cs.mayHaveMore(150, cs.CONTACTS_PAGE_LIMIT), true);
  assert.equal(cs.mayHaveMore(200, cs.CONTACTS_PAGE_LIMIT), true);
  // A smaller ask is cut at its own limit.
  assert.equal(cs.mayHaveMore(19, 20), false);
  assert.equal(cs.mayHaveMore(20, 20), true);
});

test("without the index the contacts page stops at Postgres's 100 and says there may be more", async () => {
  search.setSearchConfigForTests(null);
  const out = await cs.findContacts<{ id: string }>(contactsDb(range(1, 150)).client as never, "lucy", {
    roles: ["admin"],
    columns: COLS,
    limit: cs.CONTACTS_PAGE_LIMIT,
  });
  assert.equal(out.rows.length, 100);
  assert.equal(cs.mayHaveMore(out.found, cs.CONTACTS_PAGE_LIMIT), true);
});

test("with the index the contacts page goes past 100, up to 200", async () => {
  osAnswer = { strict: range(101, 400).map(cid) };
  const d = contactsDb(range(1, 150), { stored: range(1, 400) });
  const out = await cs.findContacts<{ id: string }>(d.client as never, "lucy", {
    roles: ["staff"],
    columns: COLS,
    limit: cs.CONTACTS_PAGE_LIMIT,
  });
  assert.equal(out.rows.length, 200);
  assert.equal(out.found, 200);
  assert.deepEqual(ids(out.rows).slice(0, 2), [cid(101), cid(102)]);
});

// ---------------------------------------------------------------- browsing

test("a contacts page in name order with the total", async () => {
  const d = fakeSupabase({ tables: { crm_contacts: range(1, 250).map(contact) } });
  const p2 = await cs.selectContactsPage<{ id: string }>(d.client as never, COLS, 2, 100);
  assert.equal(p2.total, 250);
  assert.deepEqual(ids(p2.rows), range(101, 200).map(cid));
  const req = d.calls[0]!;
  assert.deepEqual(
    req.orders.map((o) => o.column),
    ["last_name", "first_name", "id"],
  );
  assert.deepEqual(req.range, [100, 199]);
});

test("a page number past the end does not fail: the total is counted on its own", async () => {
  const d = fakeSupabase({ tables: { crm_contacts: range(1, 120).map(contact) } });
  const out = await cs.selectContactsPage<{ id: string }>(d.client as never, COLS, 9, 100);
  assert.deepEqual(out, { rows: [], total: 120 });
  assert.equal(d.calls.length, 2);
  assert.equal(d.calls[1]!.head, true);
});

test("any other failure is thrown, as on the inventory", async () => {
  const d = fakeSupabase({
    tables: { crm_contacts: range(1, 5).map(contact) },
    fail: () => ({ message: "permission denied", code: "42501" }),
  });
  await assert.rejects(cs.selectContactsPage(d.client as never, COLS, 1, 100), /permission denied/);
});

// ---------------------------------------------------------------- the pickers' route

test("the pickers' route: the accountant is refused before any query", async () => {
  for (const roles of [["accountant"], []]) {
    const d = contactsDb([1]);
    const out = await cs.contactPickerSearch(d.client as never, "lucy", roles);
    assert.equal(out.status, 403);
    assert.equal(d.calls.length, 0);
  }
  assert.equal(osRequests.length, 0);
});

test("the pickers' route keeps its shape: { results: [{ id, name, email }] }, ten at most", async () => {
  search.setSearchConfigForTests(null);
  const out = await cs.contactPickerSearch(contactsDb(range(1, 30)).client as never, " lucy ", ["staff"]);
  assert.equal(out.status, 200);
  const body = out.body as { results: { id: string; name: string; email: string | null }[]; similar: boolean };
  assert.equal(body.results.length, 10);
  assert.deepEqual(body.results[0], { id: cid(1), name: "Lucy Hare 001", email: "lucy1@example.com" });
  assert.deepEqual(body.results[1], { id: cid(2), name: "Lucy Hare 002", email: null });
  assert.equal(body.similar, false);
  // Too short: an empty answer without a query.
  const d = contactsDb([1]);
  assert.deepEqual(await cs.contactPickerSearch(d.client as never, "l", ["admin"]), {
    status: 200,
    body: { results: [], similar: false },
  });
  assert.equal(d.calls.length, 0);
});

test("the pickers' route: a failed search answers 500 with the error (the picker says so)", async () => {
  search.setSearchConfigForTests(null);
  const out = await cs.contactPickerSearch(
    contactsDb([1], { fail: (r) => r.rpc === "crm_contacts_search" }).client as never,
    "lucy",
    ["admin"],
  );
  assert.deepEqual(out, { status: 500, body: { error: "statement timeout" } });
});

test("the pickers' route asks the index for a margin over the ten it shows, within 600 ms", async () => {
  osAnswer = { strict: [cid(3)] };
  const out = await cs.contactPickerSearch(contactsDb([1, 2], { stored: [1, 2, 3] }).client as never, "lucy", ["admin"]);
  const body = out.body as { results: { id: string }[] };
  assert.deepEqual(ids(body.results), [cid(3), cid(1), cid(2)]);
  assert.equal(osRequests[0]!.body.size, cs.PICKER_ASK);
});

test("an erased contact is never offered, though crm_contacts_search still ranks it", async () => {
  search.setSearchConfigForTests(null);
  const d = fakeSupabase({
    tables: {
      crm_contacts: [
        { ...contact(1), first_name: "Erased contact", last_name: "1a2b3c4d", email: null, erased_at: "2026-11-01T00:00:00Z" },
        { ...contact(2), erased_at: null },
      ],
    },
    rpc: { crm_contacts_search: () => [contact(1), contact(2)] },
  });
  const out = await cs.findContacts(d.client as never, "contact", { roles: ["staff"], columns: COLS, limit: cs.PICKER_ASK, show: cs.PICKER_SHOW });
  assert.equal(out.error, null);
  assert.deepEqual(ids(out.rows), [cid(2)]);
});
