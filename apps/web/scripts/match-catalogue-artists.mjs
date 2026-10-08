#!/usr/bin/env node
/**
 * Link every catalogue entry (legacy exhibition catalogues in Sanity) to the
 * artist document synced from the inventory, by name.
 *
 * Names are compared as sets of tokens after folding case and diacritics, so
 * "Takeo Yamaguchi", "YAMAGUCHI Takeo" and "Yamaguchi Takeo" all meet
 * "Yamaguchi Takeo"; "Bamboo Flower Basket by Hatanaka Hōzan" matches on the
 * part after "by"; parentheticals and honorifics ("RA") are ignored. Inventory
 * alternative names and native names count too. Only exact token-set matches
 * are written; everything else is listed for a person.
 *
 * Writes, per matched entry: `artist` (weak reference to artist-<maker id>),
 * `maker` (the inventory's name), `makerAsImported` (the original string, kept
 * once). Re-runnable: entries already linked are skipped.
 *
 * Usage:
 *   SANITY_PROJECT_ID=dql8z4kv SANITY_DATASET=production SANITY_API_WRITE_TOKEN=… \
 *   node apps/web/scripts/match-catalogue-artists.mjs [--apply] [--makers makers.json]
 *
 * --makers: a JSON array [{id, display, romanized, native, alt:[…]}] exported
 * from the inventory (gives alternative names); without it only the artist
 * documents' names are used.
 */
import { readFileSync } from "node:fs";

const projectId = process.env.SANITY_PROJECT_ID ?? "dql8z4kv";
const dataset = process.env.SANITY_DATASET ?? "production";
const token = process.env.SANITY_API_WRITE_TOKEN ?? process.env.SANITY_AUTH_TOKEN;
const apply = process.argv.includes("--apply");
const makersArg = process.argv.indexOf("--makers");
const makersFile = makersArg > -1 ? process.argv[makersArg + 1] : null;
const API = "v2026-07-01";

if (apply && !token) {
  console.error("A write token is needed for --apply");
  process.exit(1);
}

async function query(q) {
  const res = await fetch(`https://${projectId}.api.sanity.io/${API}/data/query/${dataset}?query=${encodeURIComponent(q)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`query ${res.status}: ${await res.text()}`);
  return (await res.json()).result;
}

/** Fold a name to a sorted token key: case, diacritics, punctuation, order. */
function key(name) {
  if (!name) return null;
  let s = String(name)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[“”"'’‘.,;:/\\]/g, " ")
    .toLowerCase();
  if (/\bby\b/.test(s)) s = s.split(/\bby\b/).pop();
  const tokens = s
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !["ra", "attributed", "to", "the", "and", "&"].includes(t))
    .map((t) => (/^(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/.test(t) ? t : t));
  if (tokens.length === 0) return null;
  return tokens.sort().join(" ");
}

const artists = await query(`*[_type == "artist" && !(_id in path("drafts.**"))]{_id, name, nameNative, supabaseId}`);
const exhibitions = await query(`*[_type == "exhibition"]{_id, title, "items": catalogue[]{_key, maker, title, "linked": defined(artist)}}`);

// Index of name key → artist document.
const byKey = new Map();
const add = (k, a, why) => {
  if (!k) return;
  const prev = byKey.get(k);
  if (prev && prev.a._id !== a._id) {
    prev.ambiguous = true;
    prev.others = [...(prev.others ?? []), a];
    return;
  }
  if (!prev) byKey.set(k, { a, why, ambiguous: false, others: [] });
};
/** Two inventory makers share a name (a duplicate): take the one spelled exactly as the catalogue has it. */
const disambiguate = (hit, raw) => {
  const want = raw.trim().toLowerCase();
  const exact = [hit.a, ...hit.others].filter((a) => (a.name ?? "").trim().toLowerCase() === want);
  return exact.length === 1 ? exact[0] : null;
};
for (const a of artists) {
  add(key(a.name), a, "artist name");
  add(key(a.nameNative), a, "native name");
}
if (makersFile) {
  const makers = JSON.parse(readFileSync(makersFile, "utf8"));
  const artistByMaker = new Map(artists.map((a) => [a.supabaseId ?? a._id.replace(/^artist-/, ""), a]));
  for (const m of makers) {
    const a = artistByMaker.get(m.id);
    if (!a) continue;
    for (const n of [m.display, m.romanized, m.native, ...(m.alt ?? [])]) add(key(n), a, "inventory name");
  }
}

const matched = [];
const unmatched = new Map(); // maker string → count
const ambiguous = new Map();
let already = 0;
let withMaker = 0;
for (const ex of exhibitions) {
  for (const it of ex.items ?? []) {
    const raw = it.maker || (it.title && /\bby\b/i.test(it.title) ? it.title : null);
    if (!raw) continue;
    withMaker += 1;
    if (it.linked) {
      already += 1;
      continue;
    }
    const k = key(raw);
    const hit = k ? byKey.get(k) : null;
    if (!hit) {
      unmatched.set(raw, (unmatched.get(raw) ?? 0) + 1);
      continue;
    }
    let artist = hit.a;
    if (hit.ambiguous) {
      const pick = disambiguate(hit, raw);
      if (!pick) {
        ambiguous.set(raw, (ambiguous.get(raw) ?? 0) + 1);
        continue;
      }
      artist = pick;
    }
    matched.push({ exhibition: ex._id, exTitle: ex.title, key: it._key, raw, artist, why: hit.why });
  }
}

console.log(`${withMaker} catalogue entries carry a maker; ${already} already linked.`);
console.log(`${matched.length} entries match an artist (${new Set(matched.map((m) => m.artist._id)).size} artists).`);
const renamed = matched.filter((m) => m.raw.trim() !== (m.artist.name ?? "").trim());
console.log(`${renamed.length} of them will have the maker name changed to the inventory spelling.`);
if (unmatched.size) {
  console.log(`\nNo artist found for ${unmatched.size} names (${[...unmatched.values()].reduce((a, b) => a + b, 0)} entries):`);
  for (const [n, c] of [...unmatched.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${c}× ${n}`);
}
if (ambiguous.size) {
  console.log(`\nAmbiguous (two artists share the name):`);
  for (const [n, c] of ambiguous) console.log(`  ${c}× ${n}`);
}

if (!apply) {
  console.log("\nDry run — nothing written. Re-run with --apply to link them.");
  process.exit(0);
}

// One patch per exhibition, all its entries in one mutation.
const byExhibition = new Map();
for (const m of matched) {
  const list = byExhibition.get(m.exhibition) ?? [];
  list.push(m);
  byExhibition.set(m.exhibition, list);
}
const mutations = [];
for (const [exId, list] of byExhibition) {
  const set = {};
  for (const m of list) {
    const base = `catalogue[_key=="${m.key}"]`;
    set[`${base}.artist`] = { _type: "reference", _ref: m.artist._id, _weak: true };
    if (m.artist.name && m.raw.trim() !== m.artist.name.trim()) {
      set[`${base}.maker`] = m.artist.name;
      set[`${base}.makerAsImported`] = m.raw;
    }
  }
  mutations.push({ patch: { id: exId, set } });
}
const res = await fetch(`https://${projectId}.api.sanity.io/${API}/data/mutate/${dataset}`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ mutations }),
});
if (!res.ok) {
  console.error(`mutate ${res.status}: ${await res.text()}`);
  process.exit(1);
}
console.log(`\nLinked ${matched.length} entries across ${byExhibition.size} exhibitions.`);
