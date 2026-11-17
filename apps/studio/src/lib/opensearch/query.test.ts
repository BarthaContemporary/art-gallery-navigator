// node --test apps/studio/src/lib/opensearch/query.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the explicit extension; the studio's tsconfig does not allow it.
// @ts-ignore TS5097
import { MAX_QUERY_CHARS, MAX_TERMS, buildSearch, fold, isSearchable, matchedLabel, parseQuery, phoneVariants } from "./query.ts";

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

/** Every object in a body that carries the key, depth first. */
function find(node: Json, key: string, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) for (const x of node) find(x as Json, key, out);
  else if (node && typeof node === "object") {
    if (key in node) out.push(node as Record<string, unknown>);
    for (const v of Object.values(node)) find(v as Json, key, out);
  }
  return out;
}
const fuzzyQueries = (body: unknown) => find(body as Json, "fuzziness").map((o) => String(o.query));

test("identifier rule: a term with a digit or an @ is never fuzzy, in either pass", () => {
  for (const q of ["2024-0003", "0003", "J5333", "ada@example.com", "X-2026-0001", "lucy.b@", "1955", "２０２４－０００３"]) {
    for (const kind of ["works", "makers", "contacts"] as const) {
      assert.deepEqual(fuzzyQueries(buildSearch(kind, q, { fuzzy: true })), [], `${kind} ${q}`);
      assert.deepEqual(fuzzyQueries(buildSearch(kind, q)), [], `${kind} ${q}`);
    }
  }
  // Mixed: only the plain word gets typo tolerance.
  assert.deepEqual(fuzzyQueries(buildSearch("works", "Yosai 1955", { fuzzy: true })), ["Yosai"]);
  assert.deepEqual(fuzzyQueries(buildSearch("contacts", "Bewick bewick@example.com", { fuzzy: true })), ["Bewick"]);
});

test("identifier rule: a term with a digit or an @ is a phrase (its parts adjacent, in one value), never best_fields", () => {
  const textMatches = (body: unknown) =>
    find(body as Json, "multi_match").map((o) => o.multi_match as { query: string; type: string; fields: string[] });
  // (For contacts "2024-0003" is a phone search; their identifiers are emails, below.)
  for (const kind of ["works", "makers"] as const) {
    for (const fuzzy of [false, true]) {
      // "2024-0003" is the last term (typing): a phrase, and a phrase prefix.
      const id = textMatches(buildSearch(kind, "2024-0003", { fuzzy })).filter((m) => m.query === "2024-0003");
      assert.deepEqual(id.map((m) => m.type).sort(), ["phrase", "phrase_prefix"], `${kind} fuzzy=${fuzzy}`);
      // Finished (trailing space): the phrase alone.
      const done = textMatches(buildSearch(kind, "2024-0003 ", { fuzzy })).filter((m) => m.query === "2024-0003");
      assert.deepEqual(done.map((m) => m.type), ["phrase"], `${kind} fuzzy=${fuzzy}`);
    }
  }
  for (const fuzzy of [false, true]) {
    const email = textMatches(buildSearch("contacts", "lucy.bewick@example.com", { fuzzy })).filter((m) => m.query === "lucy.bewick@example.com");
    assert.deepEqual(email.map((m) => m.type).sort(), ["phrase", "phrase_prefix"], `contacts fuzzy=${fuzzy}`);
  }
  // The phrase runs over the plan's fields, `all` included (a stock number is copied there), so values stay apart.
  const works = textMatches(buildSearch("works", "2024-0003 ")).find((m) => m.type === "phrase" && m.query === "2024-0003")!;
  assert.ok(works.fields.includes("all^1"));
  // An email is an identifier too; plain words keep best_fields and bool_prefix.
  const mixed = textMatches(buildSearch("contacts", "lucy.bewick@example.com Bewick"));
  assert.deepEqual(mixed.filter((m) => m.query === "lucy.bewick@example.com").map((m) => m.type), ["phrase"]);
  assert.deepEqual(mixed.filter((m) => m.query === "Bewick").map((m) => m.type).sort(), ["best_fields", "bool_prefix"]);
  assert.deepEqual(textMatches(buildSearch("works", "Yosai 1955 ")).filter((m) => m.query === "1955").map((m) => m.type), ["phrase"]);
});

test("the strict pass has no fuzziness at all", () => {
  for (const q of ["Yosai", "netsuke ivory Masanao", "laquer boxes", "Dr Lucy Bewick"]) {
    for (const kind of ["works", "makers", "contacts"] as const) assert.deepEqual(fuzzyQueries(buildSearch(kind, q)), [], `${kind} ${q}`);
  }
});

test("fuzzy only on plain words of 4+ letters, never CJK, AUTO:4,8 with prefix_length 1", () => {
  const body = buildSearch("works", "bowl tea 塩月 Shiotsuki", { fuzzy: true });
  const f = find(body as Json, "fuzziness");
  assert.deepEqual(f.map((o) => o.query).sort(), ["Shiotsuki", "bowl"]);
  for (const o of f) {
    assert.equal(o.fuzziness, "AUTO:4,8");
    assert.equal(o.prefix_length, 1);
  }
});

test("the fuzzy pass forgives one plain word of three, never an identifier", () => {
  const relaxed = find(buildSearch("contacts", "Dr Lucy Bewick", { fuzzy: true }) as Json, "minimum_should_match");
  assert.ok(relaxed.some((o) => o.minimum_should_match === 2 && Array.isArray(o.should) && (o.should as unknown[]).length === 3));
  // "Yamamoto basket gourd 1930": the three words may lose one; 1930 stays in must.
  const body = buildSearch("works", "Yamamoto basket gourd 1930", { fuzzy: true }) as { query: { bool: { must: Record<string, unknown>[] } } };
  const must = body.query.bool.must;
  const loose = must.find((c) => (c.bool as { minimum_should_match?: number } | undefined)?.minimum_should_match === 2);
  assert.ok(loose, "one bool forgives one of the three words");
  assert.equal(must.length, 2, "the identifier clause and the relaxed words");
  assert.ok(JSON.stringify(must[0]).includes("1930"));
  // Strict never relaxes.
  assert.equal(find(buildSearch("contacts", "Dr Lucy Bewick") as Json, "minimum_should_match").length, 0);
});

test("every term must match: one dis_max per term in bool.must; the last term also as a prefix", () => {
  const body = buildSearch("works", "netsuke ivory Masa") as { query: { bool: { must: Record<string, unknown>[] } } };
  assert.equal(body.query.bool.must.length, 3);
  const prefixes = find(body as Json, "type").filter((o) => o.type === "bool_prefix");
  assert.deepEqual(prefixes.map((o) => o.query), ["Masa"]);
  // A trailing space means the word is finished.
  assert.equal(find(buildSearch("works", "netsuke ivory Masa ") as Json, "type").filter((o) => o.type === "bool_prefix").length, 0);
  assert.equal(find(buildSearch("works", "netsuke", { typing: false }) as Json, "type").filter((o) => o.type === "bool_prefix").length, 0);
});

test("stock numbers: whole-query constant boosts, exact far above contains", () => {
  const body = buildSearch("works", "2024-0003");
  const boosts = find(body as Json, "constant_score").map((o) => (o.constant_score as { boost: number }).boost);
  assert.ok(boosts.includes(1000) && boosts.includes(800) && boosts.includes(300) && boosts.includes(150));
  assert.ok(JSON.stringify(body).includes('"stock_number":"2024-0003"'));
  // Contacts and makers have no stock numbers.
  assert.ok(!JSON.stringify(buildSearch("makers", "1936")).includes("stock_number"));
});

test("caps: at most 10 terms, 200 characters, NFKC, control and marker characters removed", () => {
  const p = parseQuery(Array.from({ length: 15 }, (_, i) => `word${i}`).join(" "));
  assert.equal(p.terms.length, MAX_TERMS);
  assert.equal(parseQuery("x".repeat(500)).q.length, MAX_QUERY_CHARS);
  assert.equal(parseQuery("２０２４－０００３").q, "2024-0003");
  assert.equal(parseQuery("tea\u0000bowl").q, "tea bowl");
  const body = buildSearch("works", Array.from({ length: 30 }, () => "basket").join(" ")) as { query: { bool: { must: unknown[] } } };
  assert.equal(body.query.bool.must.length, MAX_TERMS);
});

test("quoted phrases must match; an unmatched quote is ignored; stopwords only when alone", () => {
  const p = parseQuery('"acquired from the artist" 1985');
  assert.deepEqual(p.phrases, ["acquired from the artist"]);
  assert.deepEqual(p.terms.map((t: { text: string }) => t.text), ["1985"]);
  assert.deepEqual(parseQuery('tea "bowl').terms.map((t: { text: string }) => t.text), ["tea", "bowl"]);
  const st = parseQuery("signed on the base");
  assert.deepEqual(st.terms.filter((t: { required: boolean }) => t.required).map((t: { text: string }) => t.text), ["signed", "base"]);
  assert.ok(parseQuery("the").terms[0].required, "a query of nothing but stopwords still searches");
});

test("hostile input never throws and is never parsed as query syntax", () => {
  const inputs = ["basket*", "\\", '"', '""', "AND OR NOT", "title:basket", "(a OR b)", "a~2", "{\"query\":1}", "😀", "<script>alert(1)</script>",
    "'; drop table pieces; --", "x".repeat(5000), "& | !", "*", "?", "/regex/", "‮", "_all", "0", "@", "+44"];
  for (const q of inputs) {
    for (const kind of ["works", "makers", "contacts"] as const) {
      for (const fuzzy of [false, true]) {
        const body = buildSearch(kind, q, { fuzzy, highlight: true });
        if (body === null) continue;
        const text = JSON.stringify(body);
        assert.ok(!text.includes("query_string") && !text.includes('"script"') && !text.includes('"regexp"'), `${kind} ${q}`);
        assert.ok(text.length < 100_000);
      }
    }
  }
  assert.equal(buildSearch("works", "& | !"), null, "nothing searchable");
  assert.equal(buildSearch("works", "   "), null);
  // A wildcard in the input is escaped in the inside-a-word pattern.
  const wc = find(buildSearch("works", "bask*et") as Json, "wildcard");
  assert.ok(wc.every((o) => !String((o.wildcard as { all: { value: string } }).all.value).slice(1, -1).match(/(?<!\\)\*/)));
});

test("contacts: a phone-like query is a phone search only; an email gets its exact boost", () => {
  const body = buildSearch("contacts", "+44 20 7946 0018");
  const text = JSON.stringify(body);
  assert.ok(text.includes('"phones"'));
  assert.ok(!text.includes("multi_match"), "nothing but the phone field");
  assert.ok(JSON.stringify(buildSearch("contacts", "h.tanaka@example.jp")).includes('"email.raw":"h.tanaka@example.jp"'));
  // A long digit term inside a name query may match a phone fragment, never `all`.
  assert.ok(JSON.stringify(buildSearch("contacts", "Tanaka 79460018")).includes('"phones"'));
});

test("phone variants: as typed, national, last nine digits", () => {
  assert.deepEqual(phoneVariants("+44 20 7946 0018").sort(), ["2079460018", "442079460018", "079460018"].sort());
  assert.deepEqual(phoneVariants("020 7946 0018").sort(), ["02079460018", "2079460018", "079460018"].sort());
  assert.deepEqual(phoneVariants("12"), []);
});

test("sort: score, then a stable tie-break on keywords every document has", () => {
  assert.deepEqual((buildSearch("works", "bowl") as { sort: unknown }).sort, [{ _score: "desc" }, { ledger: "desc" }, { stock_number: "desc" }, { id: "asc" }]);
  assert.deepEqual((buildSearch("makers", "bowl") as { sort: unknown }).sort, [{ _score: "desc" }, { name_sort: "asc" }, { id: "asc" }]);
  assert.deepEqual((buildSearch("contacts", "bowl") as { sort: unknown }).sort, [{ _score: "desc" }, { id: "asc" }]);
});

test("highlights: works, strict pass, real fields, plain-text markers; never contacts or the fuzzy pass", () => {
  const h = (buildSearch("works", "smith", { highlight: true }) as { highlight?: { fields: Record<string, unknown>; pre_tags: string[]; post_tags: string[]; max_analyzer_offset: number } }).highlight;
  assert.ok(h);
  assert.deepEqual(h.pre_tags, [""]);
  assert.deepEqual(h.post_tags, [""]);
  assert.equal(h.max_analyzer_offset, 100000);
  assert.ok("provenance" in h.fields && !("all" in h.fields));
  assert.equal((buildSearch("works", "smith", { highlight: true, fuzzy: true }) as { highlight?: unknown }).highlight, undefined);
  assert.equal((buildSearch("contacts", "smith", { highlight: true }) as { highlight?: unknown }).highlight, undefined);
  assert.equal((buildSearch("works", "smith") as { highlight?: unknown }).highlight, undefined);
});

test("matched in …: a label only when the visible row does not already show the match", () => {
  assert.equal(matchedLabel(["provenance"]), "provenance");
  assert.equal(matchedLabel(["description", "provenance"]), "provenance");
  assert.equal(matchedLabel(["retired_stock_numbers"]), "former stock number");
  assert.equal(matchedLabel(["title", "provenance"]), null);
  assert.equal(matchedLabel(["stock_number.grams"]), null);
  assert.equal(matchedLabel(["maker_alt_names"]), null);
  assert.equal(matchedLabel([]), null);
  assert.equal(matchedLabel(["something_new"]), null);
});

test("long enough to search: two characters, or one CJK character", () => {
  for (const q of ["ab", "塩", "竹", "か", "カ", "한", "  ab  ", "20"]) assert.equal(isSearchable(q), true, q);
  for (const q of ["", " ", "a", "&", "--", null, undefined]) assert.equal(isSearchable(q), false, String(q));
});

test("fold matches asciifolding closely enough for the inside-a-word pattern", () => {
  assert.equal(fold("Shōji Krämer Æsop Øre straße"), "shoji kramer aesop ore strasse");
});
