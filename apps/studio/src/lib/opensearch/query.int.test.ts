// Against a local OpenSearch (security off), with this run's own index prefix:
//   OPENSEARCH_TEST_URL=http://127.0.0.1:9209 node --test apps/studio/src/lib/opensearch/query.int.test.ts
// Without the variable every test here is skipped, so `pnpm test:unit` stays self-contained.
//
// The three indices are created from mappings.ts, filled with documents that
// documents.ts builds from the fixtures (scripts/studio-preview/fixtures/data,
// read through load.ts), and searched with the bodies query.ts builds: the
// key cases of the search-quality and codebase-fit reviews, then the merge
// with Postgres through searchWorkIds.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore -- plain JS test support
import { FakeDb, allowStudioImports, assertNodeCanCreate, dropIndices, os, skipWithoutNode as skip, testPrefix } from "./test-support.mjs";
// node --test needs the explicit extension; the studio's tsconfig does not allow it.
// @ts-ignore TS5097
import { INDEX_VERSION, SEARCH_KINDS, testSearchConfig } from "./config.ts";
// @ts-ignore TS5097
import { bulk, resetCircuit, searchHits, searchIds } from "./client.ts";
// @ts-ignore TS5097
import { indexBody } from "./mappings.ts";
// @ts-ignore TS5097
import { contactDoc, makerDoc, workDoc } from "./documents.ts";
// @ts-ignore TS5097
import { buildSearch, matchedLabel } from "./query.ts";

allowStudioImports();
const prefix = testPrefix("q");
const cfg = testSearchConfig(process.env.OPENSEARCH_TEST_URL || "http://127.0.0.1:1", prefix);
const db = new FakeDb();
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// Synthetic rows (not in the fixtures), as the search-quality review added: a netsuke
// by Masanao, a neighbouring stock number, an old-form kanji name, a contact with an
// organisation. Each id starts 5e for "synthetic".
const MASANAO = "5e000000-0001-4000-8000-5e0000000000";
const HAMADA = "5e000000-0002-4000-8000-5e0000000000";
const NETSUKE = "5e000000-0101-4000-8000-5e0000000000";
const NEIGHBOUR = "5e000000-0102-4000-8000-5e0000000000";
const MASHIKO = "5e000000-0103-4000-8000-5e0000000000";
function addSynthetic() {
  const base = { ...db.tables.pieces.find((p: Row) => !p.deleted_at) };
  const work = (id: string, over: Row) => ({ ...base, id, legacy_stock_number: null, description: null, comments: null, tags: [], publications: [], exhibitions: [], published_note: null, condition_report: null, signature_inscription: null, box_type: null, box_notes: null, ...over });
  db.tables.makers.push(
    { ...db.tables.makers[0], id: MASANAO, display_name: "Masanao", native_name: "正直", romanized_name: "Masanao", alt_names: [], school_or_workshop: "Kyoto", biography: null, profile_html: null },
    { ...db.tables.makers[0], id: HAMADA, display_name: "Hamada Shōji", native_name: "濱田庄司", romanized_name: "Hamada Shoji", alt_names: ["Shoji Hamada"], school_or_workshop: "Mashiko", biography: null, profile_html: null },
  );
  db.tables.pieces.push(
    work(NETSUKE, { stock_number: "2026-0338", title: "Netsuke of a rat", medium: "Ivory", maker_id: MASANAO }),
    work(NEIGHBOUR, { stock_number: "2026-0339", title: "Netsuke of an ox", medium: "Boxwood", maker_id: MASANAO }),
    work(MASHIKO, { stock_number: "2026-0412", title: "Stoneware jar", medium: "Stoneware", maker_id: HAMADA }),
  );
  const bewick = db.tables.crm_contacts.find((c: Row) => c.last_name === "Bewick");
  bewick.organization_id = db.tables.crm_organizations[0].id;
}

const works = () => db.rowsOf("vw_pieces_all").filter((p: Row) => !p.deleted_at) as Row[];
const contains = (q: string) => new Set(works().filter((p) => [p.stock_number, p.legacy_stock_number].some((s) => s && String(s).toLowerCase().includes(q.toLowerCase()))).map((p) => p.id));
const find = async (kind: "works" | "makers" | "contacts", q: string, opts: { fuzzy?: boolean } = {}) => {
  resetCircuit();
  const body = buildSearch(kind, q, { fuzzy: opts.fuzzy });
  if (!body) return [];
  const ids = await searchIds(cfg, kind, body, { size: 500, timeoutMs: 5000 });
  assert.ok(ids, `${kind} "${q}" got no answer`);
  return ids;
};
const contactId = (last: string) => db.tables.crm_contacts.find((c: Row) => c.last_name === last).id as string;
const makerId = (name: string) => db.tables.makers.find((m: Row) => m.display_name === name).id as string;

before(async () => {
  if (skip) return;
  await assertNodeCanCreate(prefix);
  addSynthetic();
  // @ts-ignore TS5097
  const load = await import("./load.ts");
  for (const kind of SEARCH_KINDS) {
    const r = await os("PUT", `/${cfg.indices[kind]}`, indexBody(kind, INDEX_VERSION[kind]));
    assert.equal(r.status, 200, `create ${kind}: ${JSON.stringify(r.json)}`);
  }
  const sources = await load.loadWorkSources(db, "all");
  const makers = await load.loadMakerRows(db, "all");
  const contacts = await load.loadContactSources(db, "all");
  const docs = {
    works: [...sources.values()].map(workDoc).filter(Boolean),
    makers: [...makers.values()].map(makerDoc).filter(Boolean),
    contacts: [...contacts.values()].map(contactDoc).filter(Boolean),
  } as Record<string, Row[]>;
  for (const kind of SEARCH_KINDS) {
    const res = await bulk(cfg, kind, docs[kind]!.map((d) => ({ op: "index", id: d.id, doc: d })), { version: 1, refresh: true });
    // dynamic "strict": a builder field the mapping lacks would fail here.
    assert.equal(res.failed + res.blocked, 0, `${kind}: ${JSON.stringify(res.items.filter((i: Row) => i.result !== "ok").slice(0, 3))}`);
    assert.equal(res.ok, docs[kind]!.length);
  }
});
after(async () => {
  if (!skip) await dropIndices(prefix);
});

test("every fixture document fits its strict mapping, and the trash and erased contacts are not there", { skip }, async () => {
  const count = async (kind: "works" | "makers" | "contacts") => (await os("GET", `/${cfg.indices[kind]}/_count`)).json.count;
  assert.equal(await count("works"), works().length);
  assert.equal(await count("makers"), db.tables.makers.length);
  assert.equal(await count("contacts"), db.tables.crm_contacts.filter((c: Row) => !c.erased_at).length);
  assert.deepEqual(await find("works", "2024-0008"), [], "a trashed stock number finds nothing");
  assert.deepEqual(await find("contacts", "Erased"), []);
});

test("contacts keep no copy: nothing can be read back from a hit", { skip }, async () => {
  const r = await os("POST", `/${cfg.indices.contacts}/_search`, { size: 3, query: { match_all: {} }, docvalue_fields: ["email.raw"], stored_fields: ["*"] });
  assert.ok(r.status === 200 || r.status === 400);
  for (const h of r.json?.hits?.hits ?? []) {
    assert.equal(h._source, undefined);
    assert.equal(h.fields, undefined);
  }
});

test("a whole stock number, current, legacy or other register, finds exactly that work", { skip }, async () => {
  const exact = works().find((p) => p.stock_number === "2024-0003")!;
  assert.deepEqual(await find("works", "2024-0003"), [exact.id]);
  const legacy = works().find((p) => p.legacy_stock_number === "J5333")!;
  assert.deepEqual(await find("works", "J5333"), [legacy.id]);
  assert.deepEqual(await find("works", "j5333"), [legacy.id]);
  const ext = works().find((p) => p.stock_number === "X-2026-0002")!;
  assert.deepEqual(await find("works", "x-2026-0002"), [ext.id]);
  assert.deepEqual(await find("works", "2026-0338"), [NETSUKE], "not its neighbour 2026-0339");
  // The fuzzy pass changes nothing for an identifier.
  assert.deepEqual(await find("works", "2024-0003", { fuzzy: true }), [exact.id]);
});

test("part of a stock number finds what Postgres's 'contains' finds, plus former numbers", { skip }, async () => {
  for (const q of ["0003", "0338", "2024-00", "X-2026"]) {
    const formerly = db.tables.piece_ledger_moves.filter((m: Row) => String(m.from_stock_number).toLowerCase().includes(q.toLowerCase())).map((m: Row) => m.piece_id);
    assert.deepEqual(new Set(await find("works", q)), new Set([...contains(q), ...formerly]), q);
  }
  assert.ok(db.tables.piece_ledger_moves.some((m: Row) => m.from_stock_number === "2024-0099"), "the fixture move that makes '2024-00' differ");
  // Separator-free, as typed from a label.
  assert.deepEqual((await find("works", "20260338"))[0], NETSUKE);
});

test("a former stock number (a register move) finds the work, labelled", { skip }, async () => {
  const moved = works().find((p) => p.stock_number === "X-2026-0001")!;
  const body = buildSearch("works", "2024-0099", { highlight: true })!;
  resetCircuit();
  const hits = await searchHits(cfg, "works", body, { size: 10, timeoutMs: 5000 });
  assert.deepEqual(hits?.map((h: Row) => h.id), [moved.id]);
  assert.equal(matchedLabel(hits![0]!.fields), "former stock number");
});

test("accents fold both ways; a typo finds the name only in the fuzzy pass", { skip }, async () => {
  const yosai = new Set(works().filter((p) => p.maker_id === makerId("Yokota Yōsai")).map((p) => p.id));
  const a = await find("works", "Yōsai");
  const b = await find("works", "yosai");
  assert.ok(a.length > 0);
  assert.deepEqual(new Set(a), new Set(b));
  for (const id of yosai) assert.ok(a.includes(id));
  assert.deepEqual(await find("works", "Yosia"), [], "the strict pass is not typo tolerant");
  const c = await find("works", "Yosia", { fuzzy: true });
  for (const id of yosai) assert.ok(c.includes(id), "the fuzzy pass finds every Yōsai work");
  assert.deepEqual(new Set(c.slice(0, yosai.size)), yosai, "and puts them first");
  // Makers: a misspelt name through the fuzzy pass.
  assert.equal((await find("makers", "Rokubai", { fuzzy: true }))[0], makerId("Kiyomizu Rokubei VI"));
  assert.equal((await find("makers", "yosai"))[0], makerId("Yokota Yōsai"));
});

test("every word must match, each in its own field", { skip }, async () => {
  assert.deepEqual(await find("works", "netsuke ivory Masanao"), [NETSUKE]);
  assert.deepEqual(new Set(await find("works", "netsuke Masanao")), new Set([NETSUKE, NEIGHBOUR]));
  const shiotsuki = makerId("Shiotsuki Juran");
  const hits = await find("works", "bamboo basket Shiotsuki");
  assert.ok(hits.length > 0);
  for (const id of hits) assert.equal(works().find((p) => p.id === id)!.maker_id, shiotsuki);
  // Typing: the last word is a prefix.
  assert.ok((await find("works", "netsuke Masa")).includes(NETSUKE));
});

test("kanji: native names, a single character, old forms", { skip }, async () => {
  const shiotsuki = new Set(works().filter((p) => p.maker_id === makerId("Shiotsuki Juran")).map((p) => p.id));
  assert.ok(shiotsuki.size > 0);
  assert.deepEqual(new Set(await find("works", "塩月")), shiotsuki);
  assert.deepEqual(new Set(await find("works", "塩")), shiotsuki);
  assert.deepEqual(await find("works", "浜田庄司"), [MASHIKO], "the modern form finds 濱田庄司");
  assert.deepEqual(await find("makers", "濱田"), [HAMADA]);
});

test("a quoted phrase must match as written", { skip }, async () => {
  const withEntry = new Set(db.tables.provenance_entries.filter((e: Row) => /acquired from the artist/i.test(`${e.date_text ?? ""} ${e.party ?? ""} ${e.details ?? ""}`)).map((e: Row) => e.piece_id));
  const live = new Set(works().map((p) => p.id));
  const expected = new Set([...withEntry].filter((id) => live.has(id)));
  assert.ok(expected.size > 0);
  assert.deepEqual(new Set(await find("works", '"acquired from the artist"')), expected);
});

test("phones in any form, and only the right number", { skip }, async () => {
  const bewick = contactId("Bewick"); // 020 7946 0018
  const quennell = contactId("Quennell"); // +44 7700 900104
  for (const q of ["020 7946 0018", "+44 20 7946 0018", "02079460018", "0044 20 7946 0018", "7946 0018"]) {
    assert.deepEqual(await find("contacts", q), [bewick], q);
  }
  for (const q of ["+447700900104", "07700 900104", "07700900104"]) assert.deepEqual(await find("contacts", q), [quennell], q);
});

test("emails: whole, by part, by name part", { skip }, async () => {
  const bewick = contactId("Bewick");
  assert.equal((await find("contacts", "lucy.bewick@example.com"))[0], bewick);
  const byEmail = (part: string) => new Set(db.tables.crm_contacts.filter((c: Row) => !c.erased_at && String(c.email ?? "").includes(part)).map((c: Row) => c.id));
  assert.equal(byEmail("bewick@").size, 3, "Lucy, Matilda and Florence Bewick");
  assert.deepEqual(new Set(await find("contacts", "bewick@")), byEmail("bewick@"));
  assert.equal((await find("contacts", "lucy.b"))[0], bewick);
  assert.equal((await find("contacts", "lucy.bewick@example.com", { fuzzy: true }))[0], bewick);
});

test("contacts by name, typo, organisation and city", { skip }, async () => {
  const bewick = contactId("Bewick");
  assert.equal((await find("contacts", "Lucy Bewick"))[0], bewick);
  assert.deepEqual(await find("contacts", "Bewik"), []);
  assert.equal((await find("contacts", "Bewik", { fuzzy: true }))[0], bewick);
  assert.equal((await find("contacts", "Dr Lucy Bewick", { fuzzy: true }))[0], bewick, "one unmatched word forgiven");
  const org = db.tables.crm_organizations[0].name as string;
  assert.ok((await find("contacts", org)).includes(bewick));
  assert.ok((await find("contacts", "Lucy Edinburgh")).includes(contactId("Quennell")));
});

test("the merge: Postgres's stock hits lead, nothing Postgres finds is lost, a brand-new work is found", { skip }, async () => {
  // @ts-ignore TS5097
  const search = await import("./search.ts");
  search.setSearchConfigForTests(cfg);
  try {
    resetCircuit();
    let r = await search.searchWorkIds(db, "0003", { roles: ["staff"], timeoutMs: 5000 });
    assert.equal(r.error, null);
    assert.deepEqual(new Set(r.ids), contains("0003"));
    // A work saved a second ago that the index has not been told about.
    const fresh = { ...db.tables.pieces.find((p: Row) => p.id === NETSUKE), id: "5e000000-0199-4000-8000-5e0000000000", stock_number: "2026-0999", title: "Brand new" };
    db.tables.pieces.push(fresh);
    r = await search.searchWorkIds(db, "2026-0999", { roles: ["admin"], timeoutMs: 5000 });
    assert.deepEqual(r.ids, [fresh.id]);
    // Only OpenSearch knows the provenance: found and labelled.
    r = await search.searchWorkIds(db, "acquired artist", { roles: ["admin"], timeoutMs: 5000 });
    assert.ok(r.ids.length > 0);
    assert.ok(Object.values(r.matched ?? {}).includes("provenance"));
    // Nothing exact anywhere: the fuzzy pass, labelled similar.
    r = await search.searchWorkIds(db, "Yosia", { roles: ["staff"], fuzzy: true, timeoutMs: 5000 });
    assert.equal(r.similar, true);
    assert.ok(r.ids.length > 0);
    // Contacts and makers.
    const c = await search.searchContactIds(db, "7946 0018", { roles: ["staff"], limit: 5, timeoutMs: 5000 });
    assert.deepEqual(c.ids, [contactId("Bewick")], "the phone is in the index only");
    const m = await search.searchMakerIds(db, "Yōsai", { roles: ["staff"], limit: 4, timeoutMs: 5000 });
    assert.equal(m.ids[0], makerId("Yokota Yōsai"));
  } finally {
    search.setSearchConfigForTests(undefined);
  }
});
