/*
 * Settings and mappings for the three indices (works, makers, contacts).
 * Pure data, import-free. Tested on OpenSearch 3.9.0 by the search-quality
 * review (118 queries over the fixtures) and by mappings.int.test.ts.
 *
 * Changing anything here changes what the index holds: bump the kind's
 * INDEX_VERSION in config.ts (mappings.test.ts fails until you do). The
 * reconcile then builds the new version beside the old one and deletes the
 * old one once the new one is full.
 *
 * Choices, each tested:
 *  - one shard, no replica (one node: a replica would leave every index yellow);
 *  - refresh_interval "1s" stated ON PURPOSE: left at its default, a shard
 *    nobody searched for 30 s stops refreshing and the next search waits for
 *    one (941 ms measured against 6 ms with this line);
 *  - index.max_ngram_diff 11 (phone grams 4..15; creation fails without it);
 *  - dynamic "strict" on every mapping: a field the document builders were
 *    never meant to send is refused by the engine, not indexed;
 *  - similarity "boolean" on every text field: a match scores its field's
 *    boost and nothing else, so the order is the one the query states;
 *  - English stemming (Porter2) only in prose fields and `.en` subfields;
 *    names are never stemmed (Lucy would become "luci");
 *  - stock numbers: exact keyword, n-grams of the value as written (3..12),
 *    and a separator-free form ("20260338");
 *  - phones: digits only, n-grams 4..15, never copied into `all`;
 *  - email: split on punctuation, plus a keyword for the exact address;
 *  - every document carries its uuid as the keyword `id`, the stable
 *    tie-break and the sort key the reconcile pages its id list by.
 *
 * Contacts keep no copy of the documents: `_source` off and no doc values on
 * the keyword fields, so whoever holds a search password can test guesses
 * but cannot read the client list out (the uuid `id` keeps its doc values:
 * it is what every hit returns as `_id` anyway). Their fields are trimmed to
 * name, organisation, email, phone and WhatsApp digits, city and country.
 *
 * There is no records index: offers, documents, shipments and lists are
 * searched in Postgres through the user's own client.
 */

import type { SearchKind } from "./config";

/** Old-form (kyūjitai) and variant kanji that turn up in names, mapped to the modern form. */
export const KANJI_VARIANTS = [
  "齋=>斎", "齊=>斉", "濱=>浜", "澤=>沢", "邊=>辺", "邉=>辺", "龍=>竜", "廣=>広", "國=>国", "藝=>芸", "寶=>宝", "萬=>万",
  "瀧=>滝", "櫻=>桜", "德=>徳", "髙=>高", "﨑=>崎", "嶋=>島", "嶌=>島", "眞=>真", "惠=>恵", "榮=>栄", "彌=>弥", "與=>与",
  "圓=>円", "壽=>寿", "樂=>楽", "靜=>静", "豐=>豊", "顯=>顕", "禮=>礼", "傳=>伝", "學=>学", "會=>会", "舊=>旧", "畫=>画",
  "盡=>尽", "鐵=>鉄", "體=>体", "燒=>焼", "澁=>渋", "淺=>浅", "黑=>黒", "增=>増", "曾=>曽", "條=>条", "關=>関",
] as const;

const analysis = {
  char_filter: {
    kanji_variants: { type: "mapping", mappings: [...KANJI_VARIANTS] },
    digits_only: { type: "pattern_replace", pattern: "[^0-9]", replacement: "" },
    alnum_only: { type: "pattern_replace", pattern: "[^\\p{L}\\p{N}]", replacement: "" },
  },
  tokenizer: {
    parts: { type: "char_group", tokenize_on_chars: ["whitespace", "punctuation", "symbol"] },
  },
  filter: {
    en_possessive: { type: "stemmer", language: "possessive_english" },
    en_stop: { type: "stop", stopwords: "_english_" },
    en_stem: { type: "stemmer", language: "english" },
    code_grams: { type: "ngram", min_gram: 3, max_gram: 12 },
    phone_grams: { type: "ngram", min_gram: 4, max_gram: 15 },
  },
  normalizer: {
    code: { type: "custom", filter: ["cjk_width", "lowercase", "asciifolding"] },
    compact: { type: "custom", char_filter: ["alnum_only"], filter: ["cjk_width", "lowercase", "asciifolding"] },
  },
  analyzer: {
    // Names, titles and the catch-all: no stemming, no stopwords.
    folded: { type: "custom", char_filter: ["kanji_variants"], tokenizer: "standard", filter: ["cjk_width", "lowercase", "asciifolding", "en_possessive"] },
    // Descriptive text: the same plus English stopwords and Porter2.
    english_folded: { type: "custom", char_filter: ["kanji_variants"], tokenizer: "standard", filter: ["cjk_width", "lowercase", "asciifolding", "en_possessive", "en_stop", "en_stem"] },
    // Native-script names as bigrams.
    cjk_names: { type: "custom", char_filter: ["kanji_variants"], tokenizer: "standard", filter: ["cjk_width", "lowercase", "cjk_bigram"] },
    code_grams_index: { type: "custom", tokenizer: "keyword", filter: ["cjk_width", "lowercase", "asciifolding", "code_grams"] },
    code_grams_search: { type: "custom", tokenizer: "keyword", filter: ["cjk_width", "lowercase", "asciifolding"] },
    phone_index: { type: "custom", char_filter: ["digits_only"], tokenizer: "keyword", filter: ["phone_grams"] },
    phone_search: { type: "custom", char_filter: ["digits_only"], tokenizer: "keyword" },
    email_parts: { type: "custom", tokenizer: "parts", filter: ["lowercase", "asciifolding"] },
  },
};

export const SETTINGS = {
  number_of_shards: 1,
  number_of_replicas: 0,
  refresh_interval: "1s",
  "index.max_ngram_diff": 11,
  analysis,
} as const;

// ------------------------------------------------------------------ field shapes
const kw = { type: "keyword" };
const bool = { type: "boolean" };
const flat = { similarity: "boolean" };
const en = { type: "text", analyzer: "english_folded", ...flat };
/** A name-like field: folded, no stemming. */
const name = { type: "text", analyzer: "folded", ...flat, copy_to: "all" };
/** A title-like field: folded, with a stemmed twin for plural and singular. */
const title = { type: "text", analyzer: "folded", ...flat, copy_to: "all", fields: { en } };
/** Descriptive prose: stemmed, stopwords removed. */
const prose = { type: "text", analyzer: "english_folded", ...flat, copy_to: "all" };
/** A native-script name: unigrams through `folded`, bigrams through `cjk_names`. */
const native = { type: "text", analyzer: "folded", ...flat, copy_to: "all", fields: { cjk: { type: "text", analyzer: "cjk_names", ...flat } } };
/** A stock number: exact, "contains" (3..12 characters as written), and separator-free. */
const code = {
  type: "keyword",
  normalizer: "code",
  copy_to: "all",
  fields: {
    grams: { type: "text", analyzer: "code_grams_index", search_analyzer: "code_grams_search", ...flat, norms: false, index_options: "docs" },
    compact: { type: "keyword", normalizer: "compact" },
  },
};
/** The catch-all every term is checked against. Never returned, never highlighted. */
const all = { type: "text", analyzer: "folded", ...flat, fields: { en } };
/** A sort key: the folded name. */
const sortKey = { type: "keyword", normalizer: "code" };

// Contacts: keyword fields without doc values (nothing can be read back out).
const contactName = { type: "text", analyzer: "folded", ...flat, copy_to: "all" };

const MAPPINGS = {
  works: {
    dynamic: "strict",
    properties: {
      id: kw,
      stock_number: code,
      legacy_stock_number: code,
      retired_stock_numbers: code,
      title,
      maker_id: kw,
      maker_name: name,
      maker_romanized: name,
      maker_alt_names: name,
      maker_native: native,
      maker_school: name,
      category: title,
      category_id: kw,
      medium: title,
      period: title,
      year: name,
      origin_region: name,
      description: prose,
      condition_report: prose,
      signature_inscription: prose,
      box_notes: prose,
      dimensions_display: prose,
      comments: prose,
      publications: prose,
      exhibitions: prose,
      published_note: prose,
      provenance: prose,
      tags: name,
      location: name,
      location_id: kw,
      status: kw,
      ledger: kw,
      web_visible: bool,
      framed: bool,
      all,
    },
  },
  makers: {
    dynamic: "strict",
    properties: {
      id: kw,
      name,
      name_sort: sortKey,
      romanized_name: name,
      alt_names: name,
      native_name: native,
      school: name,
      life_dates: name,
      region: name,
      biography: prose,
      web_visible: bool,
      all,
    },
  },
  contacts: {
    dynamic: "strict",
    _source: { enabled: false },
    properties: {
      id: kw,
      first_name: contactName,
      last_name: contactName,
      name: contactName,
      organization: contactName,
      email: {
        type: "text",
        analyzer: "email_parts",
        ...flat,
        copy_to: "all",
        fields: { raw: { type: "keyword", normalizer: "code", doc_values: false } },
      },
      // Not copied into `all`: phone digits are only ever matched as phone digits.
      phones: { type: "text", analyzer: "phone_index", search_analyzer: "phone_search", ...flat, norms: false, index_options: "docs" },
      city: contactName,
      country: contactName,
      all,
    },
  },
} as const;

/** The fields each kind's documents may carry: exactly the mapping's top-level properties. */
export function mappedFields(kind: SearchKind): string[] {
  return Object.keys(MAPPINGS[kind].properties);
}

/** The PUT body for a kind's index, its mapping stamped with the schema (index) version. */
export function indexBody(kind: SearchKind, schemaVersion: number): { settings: typeof SETTINGS; mappings: Record<string, unknown> } {
  return { settings: SETTINGS, mappings: { ...MAPPINGS[kind], _meta: { schema_version: schemaVersion } } };
}

/** Settings and mappings without the _meta stamp, for the version fingerprint in mappings.test.ts. */
export function definition(kind: SearchKind): { settings: typeof SETTINGS; mappings: (typeof MAPPINGS)[SearchKind] } {
  return { settings: SETTINGS, mappings: MAPPINGS[kind] };
}
