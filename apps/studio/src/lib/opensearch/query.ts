/*
 * Query bodies for the three indices. Pure and import-free apart from types:
 * a string in, a search body out. Nothing typed by a user is ever parsed as
 * query syntax (no query_string): 27 hostile inputs (wildcards, backslashes,
 * unbalanced quotes, "title:basket", 500 characters, markup) return results
 * or nothing, never an error.
 *
 * The shape, for every index:
 *   - the query is NFKC-normalised (full-width input from a Japanese
 *     keyboard), cut at MAX_QUERY_CHARS, split on whitespace; terms with no
 *     letter or digit are dropped ("&"); English stopwords are ignored unless
 *     the query is nothing but stopwords; at most MAX_TERMS terms; text in
 *     double quotes is a phrase;
 *   - EVERY remaining term must match somewhere (bool.must, one dis_max per
 *     term): in a named field, anywhere in `all`, as a prefix when it is the
 *     last term being typed, inside a stock number when it has a digit, as a
 *     phone number when it is digits, or inside a longer word ("kimono" in
 *     "okimono") as the weakest alternative;
 *   - IDENTIFIER RULE: a term with a digit or an "@" (a stock number, a year,
 *     a phone number, an email) is never fuzzy, and is matched as a phrase:
 *     its parts ("2024", "0003") next to each other in one value. With
 *     fuzziness on every word "2024-0003" matched 77 of 119 fixture works
 *     where Postgres finds one; without the phrase it still matched a
 *     2019-0003 exhibited in November 2024;
 *   - two passes. `strict` has no fuzziness at all. `fuzzy` (asked for only
 *     when the strict pass and Postgres found nothing) adds fuzziness
 *     "AUTO:4,8", prefix_length 1, to plain words of 4+ letters (no digit, no
 *     CJK), and forgives one unmatched plain word when three or more terms
 *     were typed; identifiers and phrases stay required;
 *   - whole-query stock-number boosts are constant scores far above any text
 *     score: exact, separator-free exact, prefix, contains;
 *   - sort: score, then a stable tie-break (equal scores otherwise come back
 *     in the index's internal order, which a reconcile can change).
 */
import type { SearchKind } from "./config";

export const MAX_TERMS = 10;
export const MAX_QUERY_CHARS = 200;

const STOPWORDS = new Set(["a", "an", "and", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "with"]);
const HAS_WORD_CHAR = /[\p{L}\p{N}]/u;
const HAS_DIGIT = /\p{Nd}/u;
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const LETTERS_ONLY = /^[\p{L}\p{M}]+$/u;
/** A whole query that can only be a phone number: digits and phone punctuation, 4+ digits. */
const PHONE_LIKE = /^[+(]?[\d\s().\-/]{4,}$/;

/** Long enough to search: two characters, or one Han / Hiragana / Katakana / Hangul character ("塩"). */
export function isSearchable(q: string | null | undefined): boolean {
  const t = String(q ?? "").normalize("NFKC").trim();
  if (!HAS_WORD_CHAR.test(t)) return false;
  return [...t].length >= 2 || CJK.test(t);
}

/** What asciifolding does to Latin text, closely enough for a wildcard pattern. */
export function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/g, "ss")
    .replace(/[æÆ]/g, "ae")
    .replace(/[øØ]/g, "o")
    .replace(/[łŁ]/g, "l")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}
const escapeWildcard = (s: string) => s.replace(/[\\*?]/g, "\\$&");

export type Term = {
  text: string;
  /** The last term, still being typed: also matched as a prefix. */
  last: boolean;
  /** False for a stopword next to real words. */
  required: boolean;
  /** Contains a digit or an "@": an identifier, never fuzzy. */
  identifier: boolean;
  digit: boolean;
  /** A plain word of 4+ letters (no digit, no CJK): may be fuzzy, may match inside a longer word. */
  wordy: boolean;
};
export type ParsedQuery = { q: string; phrases: string[]; terms: Term[]; phoneLike: boolean };

/**
 * Split input into phrases (double-quoted) and terms. `typing` says whether
 * the last term may still be incomplete (true for search-as-you-type boxes;
 * a trailing space means the word is finished).
 */
export function parseQuery(raw: unknown, { typing = true }: { typing?: boolean } = {}): ParsedQuery {
  const textIn = String(raw ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .slice(0, MAX_QUERY_CHARS);
  const endsWithSpace = /\s$/.test(textIn);
  const q = textIn.trim().replace(/\s+/g, " ");
  const phrases: string[] = [];
  const rest = q
    .replace(/"([^"]*)"/g, (_, p: string) => {
      if (HAS_WORD_CHAR.test(p) && phrases.length < MAX_TERMS) phrases.push(p.trim());
      return " ";
    })
    .replace(/"/g, " ");
  const words = rest.split(" ").filter((t) => HAS_WORD_CHAR.test(t)).slice(0, MAX_TERMS);
  const content = words.filter((w) => !STOPWORDS.has(w.toLowerCase()));
  const terms = words.map((w, i): Term => {
    const identifier = /[\d@]/.test(w) || HAS_DIGIT.test(w);
    const letters = LETTERS_ONLY.test(w) && !CJK.test(w);
    return {
      text: w,
      last: typing && !endsWithSpace && i === words.length - 1,
      required: content.length === 0 || !STOPWORDS.has(w.toLowerCase()),
      identifier,
      digit: HAS_DIGIT.test(w),
      wordy: !identifier && letters && [...w].length >= 4,
    };
  });
  return { q, phrases, terms, phoneLike: PHONE_LIKE.test(q) && (q.match(/\d/g) ?? []).length >= 4 };
}

/** Digit strings a typed phone number may be stored as: as typed, without the trunk 0 or +44/0044, and its last 9 digits. */
export function phoneVariants(input: string): string[] {
  const d = input.replace(/\D/g, "");
  const out = new Set<string>();
  if (d.length >= 4) out.add(d.slice(-15));
  const national = d.replace(/^(?:00)?44(?=\d{9,10}$)/, "").replace(/^0+/, "");
  if (national.length >= 4) out.add(national.slice(-15));
  if (d.length >= 10) out.add(d.slice(-9));
  return [...out];
}

// ------------------------------------------------------------------ per-index field plans

type Plan = {
  fields: string[];
  prefixFields: string[];
  fuzzyFields: string[];
  codes: [string, number][];
  phraseFields: string[];
  sort: Record<string, "asc" | "desc">[];
  highlight: string[];
};

const PLANS: Record<SearchKind, Plan> = {
  works: {
    fields: ["title^8", "title.en^6", "maker_name^7", "maker_alt_names^5", "maker_romanized^5", "maker_native^4", "maker_native.cjk^6",
      "maker_school^3", "category^4", "category.en^3", "medium^3", "medium.en^2.5", "period^2", "period.en^1.5", "year^3",
      "origin_region^2", "tags^3", "location^1.5", "all^1", "all.en^0.8"],
    prefixFields: ["title^4", "maker_name^4", "maker_alt_names^3", "maker_romanized^3", "category^2", "medium^1.5", "all^0.5"],
    // all.en so that a misspelt word still reaches its inflections ("laquer" finds "lacquered")
    fuzzyFields: ["title^2", "maker_name^2", "maker_alt_names^1.5", "maker_romanized^1.5", "all^0.5", "all.en^0.4"],
    codes: [["stock_number", 1], ["legacy_stock_number", 0.9], ["retired_stock_numbers", 0.8]],
    phraseFields: ["title^6", "title.en^4", "maker_name^6", "maker_alt_names^4", "all^2", "all.en^1.5"],
    // equal scores: the gallery's own stock before the external register, newest number first
    sort: [{ _score: "desc" }, { ledger: "desc" }, { stock_number: "desc" }, { id: "asc" }],
    // Real fields only (`all` is a copy_to target and has nothing to highlight).
    // Used to NAME the field that matched, never to show its text.
    highlight: ["title", "maker_name", "maker_alt_names", "maker_romanized", "maker_native", "stock_number", "stock_number.grams",
      "legacy_stock_number", "legacy_stock_number.grams", "retired_stock_numbers", "retired_stock_numbers.grams",
      "maker_school", "category", "medium", "period", "year", "origin_region", "tags", "location", "description", "provenance",
      "condition_report", "signature_inscription", "box_notes", "dimensions_display", "publications", "exhibitions",
      "published_note", "comments"],
  },
  makers: {
    fields: ["name^8", "alt_names^6", "romanized_name^6", "native_name^5", "native_name.cjk^7", "school^3", "region^2", "life_dates^2", "all^1", "all.en^0.8"],
    prefixFields: ["name^4", "alt_names^3", "romanized_name^3", "school^1.5", "all^0.5"],
    fuzzyFields: ["name^2", "alt_names^1.5", "romanized_name^1.5", "all^0.5", "all.en^0.4"],
    codes: [],
    phraseFields: ["name^6", "alt_names^4", "romanized_name^4", "all^2"],
    sort: [{ _score: "desc" }, { name_sort: "asc" }, { id: "asc" }],
    highlight: [],
  },
  contacts: {
    fields: ["last_name^8", "first_name^6", "name^6", "organization^5", "email^4", "city^3", "country^2", "all^1"],
    prefixFields: ["last_name^4", "first_name^3", "name^3", "organization^2.5", "email^2", "city^1.5", "all^0.5"],
    fuzzyFields: ["last_name^2", "first_name^1.5", "organization^1.5", "city^1", "all^0.5"],
    codes: [],
    phraseFields: ["name^6", "organization^4", "all^2"],
    // Contacts keep no doc values but the uuid: the tie-break is the id.
    sort: [{ _score: "desc" }, { id: "asc" }],
    highlight: [], // _source is off: there is nothing to highlight, and nothing is shown from the index
  },
};

type Clause = Record<string, unknown>;
const constant = (filter: Clause, boost: number): Clause => ({ constant_score: { filter, boost } });

/** One term: the alternatives it may match by, best one scoring. */
function termClause(plan: Plan, term: Term, kind: SearchKind, fuzzy: boolean): Clause {
  const t = term.text;
  const alts: Clause[] = [];
  if (term.identifier) {
    // An identifier's parts must stand next to each other, in order, in ONE
    // value, as Postgres's '2024' <-> '0003' requires. With best_fields and
    // operator "and", "2024-0003" split into "2024" and "0003", and `all`
    // let them come from different fields: a 2019-0003 exhibited in November
    // 2024 matched. A phrase cannot cross values (position_increment_gap).
    alts.push({ multi_match: { query: t, type: "phrase", fields: plan.fields } });
    if (term.last) alts.push({ multi_match: { query: t, type: "phrase_prefix", fields: plan.prefixFields } });
  } else {
    alts.push({ multi_match: { query: t, type: "best_fields", operator: "and", tie_breaker: 0.1, fields: plan.fields } });
    if (term.last) alts.push({ multi_match: { query: t, type: "bool_prefix", operator: "and", fields: plan.prefixFields } });
  }
  if (term.digit) {
    for (const [field, w] of plan.codes) {
      alts.push(constant({ match: { [`${field}.grams`]: t } }, 3 * w)); // contains, 3..12 characters as typed
      alts.push(constant({ prefix: { [`${field}.compact`]: { value: t } } }, 4 * w)); // "20260338", "x2026"
      if (term.last) alts.push(constant({ prefix: { [field]: { value: t } } }, 4 * w));
    }
    if (kind === "contacts") {
      const variants = phoneVariants(t).filter((v) => v.length >= 6); // a bare term needs 6+ digits to count as a phone fragment
      if (variants.length) alts.push(constant({ bool: { should: variants.map((v) => ({ match: { phones: v } })) } }, 3));
    }
  }
  if (term.wordy) {
    if (fuzzy) {
      alts.push({ multi_match: { query: t, type: "best_fields", operator: "and", fuzziness: "AUTO:4,8", prefix_length: 1, fields: plan.fuzzyFields } });
    }
    // Inside a longer word, as Postgres ILIKE does ("kimono" finds "okimono"); weakest of all.
    alts.push(constant({ wildcard: { all: { value: `*${escapeWildcard(fold(t))}*` } } }, 0.2));
  }
  return alts.length === 1 ? (alts[0] as Clause) : { dis_max: { tie_breaker: 0.1, queries: alts } };
}

export type BuildOptions = {
  /** false = the strict pass; true = the typo-tolerant pass, only when strict found nothing. */
  fuzzy?: boolean;
  /** The last term may be incomplete (prefix match). */
  typing?: boolean;
  /** Ask for highlights (works, strict pass only), to name the matched field. */
  highlight?: boolean;
};

/**
 * The search body for one index, or null when nothing searchable was typed.
 * size and _source are set by the client (searchHits).
 */
export function buildSearch(kind: SearchKind, raw: unknown, opts: BuildOptions = {}): Record<string, unknown> | null {
  const fuzzy = opts.fuzzy === true;
  const plan = PLANS[kind];
  const parsed = parseQuery(raw, { typing: opts.typing ?? true });

  const must: Clause[] = [];
  const relaxable: Clause[] = [];
  const should: Clause[] = [];

  if (kind === "contacts" && parsed.phoneLike) {
    // "020 7946 0018", "+44 7700 900104": the whole query is a number, in any spacing.
    must.push({ bool: { should: phoneVariants(parsed.q).map((v) => ({ match: { phones: v } })), minimum_should_match: 1 } });
  } else {
    for (const p of parsed.phrases) {
      must.push({ multi_match: { query: p, type: "phrase", fields: ["all", "all.en"] } });
      should.push({ multi_match: { query: p, type: "phrase", fields: plan.phraseFields } });
    }
    // Stopwords next to real words are ignored altogether: as optional
    // clauses they only distorted the order.
    for (const term of parsed.terms) {
      if (!term.required) continue;
      const clause = termClause(plan, term, kind, fuzzy);
      if (term.identifier) must.push(clause);
      else relaxable.push(clause);
    }
    // Whole-query boost: the words next to each other, in order, in one field.
    if (parsed.terms.length > 1) {
      should.push({ multi_match: { query: parsed.terms.map((t) => t.text).join(" "), type: "phrase", slop: 1, fields: plan.phraseFields } });
    }
    // Whole-query stock-number boosts (constant, far above any text score).
    if (parsed.q && HAS_DIGIT.test(parsed.q)) {
      for (const [field, w] of plan.codes) {
        should.push(constant({ term: { [field]: parsed.q } }, 1000 * w));
        should.push(constant({ term: { [`${field}.compact`]: parsed.q } }, 800 * w));
        should.push(constant({ prefix: { [field]: { value: parsed.q } } }, 300 * w));
        should.push(constant({ prefix: { [`${field}.compact`]: { value: parsed.q } } }, 250 * w));
        if (!parsed.q.includes(" ")) should.push(constant({ match: { [`${field}.grams`]: parsed.q } }, 150 * w));
      }
    }
    if (kind === "contacts" && parsed.q.includes("@") && !parsed.q.includes(" ")) {
      should.push(constant({ term: { "email.raw": parsed.q } }, 1000));
    }
  }

  if (must.length + relaxable.length === 0) return null;

  // The fuzzy pass forgives ONE unmatched plain word when three or more terms
  // were typed ("Dr Lucy Bewick"); identifiers and phrases stay required. The
  // words sit in their own bool so that the boosts in `should` cannot stand
  // in for one.
  if (fuzzy && must.length + relaxable.length >= 3 && relaxable.length >= 2) {
    must.push({ bool: { should: relaxable, minimum_should_match: relaxable.length - 1 } });
  } else {
    must.push(...relaxable);
  }

  const body: Record<string, unknown> = { query: { bool: { must, should } }, sort: plan.sort };
  if (opts.highlight && !fuzzy && plan.highlight.length) {
    body.highlight = {
      type: "unified",
      require_field_match: false,
      encoder: "default",
      pre_tags: [""],
      post_tags: [""],
      number_of_fragments: 1,
      fragment_size: 40,
      no_match_size: 0,
      // Without this, one document with a text field over 1,000,000
      // characters makes every search that matches it fail with HTTP 400.
      max_analyzer_offset: 100000,
      fields: Object.fromEntries(plan.highlight.map((f) => [f, {}])),
    };
  }
  return body;
}

// ------------------------------------------------------------------ "matched in …"

/** Fields a palette or list row already shows (title, maker, stock numbers): a match there needs no label. */
const VISIBLE = new Set(["title", "maker_name", "maker_alt_names", "maker_romanized", "maker_native", "stock_number", "stock_number.grams",
  "legacy_stock_number", "legacy_stock_number.grams"]);

/** In order of preference: the first one that matched names the match. Labels only, never index text. */
const LABELS: [string, string][] = [
  ["retired_stock_numbers", "former stock number"],
  ["retired_stock_numbers.grams", "former stock number"],
  ["provenance", "provenance"],
  ["signature_inscription", "signature"],
  ["box_notes", "box"],
  ["description", "description"],
  ["publications", "publications"],
  ["published_note", "publications"],
  ["exhibitions", "exhibitions"],
  ["condition_report", "condition report"],
  ["comments", "comments"],
  ["tags", "tags"],
  ["medium", "medium"],
  ["period", "period"],
  ["year", "year"],
  ["category", "category"],
  ["maker_school", "school"],
  ["origin_region", "region"],
  ["location", "location"],
  ["dimensions_display", "dimensions"],
];

/** The label for a work hit's highlighted fields, or null when the visible row already shows the match. */
export function matchedLabel(fields: readonly string[]): string | null {
  if (fields.length === 0 || fields.some((f) => VISIBLE.has(f))) return null;
  for (const [field, label] of LABELS) if (fields.includes(field)) return label;
  return null;
}
