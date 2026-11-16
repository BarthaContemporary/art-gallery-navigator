/**
 * Text folding for search: lower-case and drop the accents of Latin letters,
 * so "hozan" finds "Hatanaka Hōzan", "ohara" finds "Ōhara" and "shomin"
 * finds "Shômin". Only the Latin combining marks (U+0300–U+036F) are
 * stripped, and the text is recomposed afterwards, so kana keep their voicing
 * marks (が stays が; a bare か does not match it) and kanji are untouched.
 *
 * Client-safe and import-free: the search index (server) folds its haystack
 * and the query with it, and the search overlay (browser) uses
 * highlightParts() to bold the matched part of a result.
 */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC").toLowerCase();
}

/** The whitespace-separated search terms of a query, folded. */
export function foldedTerms(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean);
}

export type HighlightPart = { text: string; match: boolean };

/**
 * `text` cut into plain and matched parts for every occurrence of the
 * query's terms, matching folded against folded. The parts join up to the
 * text in its composed (NFC) form, which looks the same. Each character is
 * folded on its own and mapped back, so a letter whose folded form has
 * another length cannot shift what is bolded.
 */
export function highlightParts(text: string, query: string): HighlightPart[] {
  const src = text.normalize("NFC");
  const terms = foldedTerms(query);
  if (terms.length === 0 || !src) return src ? [{ text: src, match: false }] : [];

  let folded = "";
  // origin[i]: the index in `src` of the character folded[i] came from.
  const origin: number[] = [];
  let i = 0;
  for (const ch of src) {
    const f = fold(ch);
    for (let k = 0; k < f.length; k++) origin.push(i);
    folded += f;
    i += ch.length;
  }
  /** End (exclusive, in `src`) of the source character folded[j] came from. */
  const endOf = (j: number): number => {
    const o = origin[j] as number;
    const cp = src.codePointAt(o) ?? 0;
    return o + (cp > 0xffff ? 2 : 1);
  };

  const marks: [number, number][] = [];
  for (const t of terms) {
    let at = folded.indexOf(t);
    while (at !== -1) {
      marks.push([origin[at] as number, endOf(at + t.length - 1)]);
      at = folded.indexOf(t, at + t.length);
    }
  }
  marks.sort((a, b) => a[0] - b[0]);

  const parts: HighlightPart[] = [];
  let pos = 0;
  for (const [s, e] of marks) {
    if (s < pos) continue;
    if (s > pos) parts.push({ text: src.slice(pos, s), match: false });
    parts.push({ text: src.slice(s, e), match: true });
    pos = e;
  }
  if (pos < src.length) parts.push({ text: src.slice(pos), match: false });
  return parts;
}
