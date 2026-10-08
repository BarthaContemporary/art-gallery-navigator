/**
 * Life dates as the inventory writes them, in one form for the site:
 * "1901–1957", "b. 1948", "d. 2001", "c. 1900". Ranges take the unspaced
 * en dash the site's dates already use; a stray hyphen or spaced dash, and
 * "b.1948" without its space, are the usual inconsistencies.
 */
export function formatLifeDates(raw: string | null | undefined): string | null {
  const s = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s
    .replace(/(\d{3,4})\s*[-–—]\s*(\d{3,4})/g, "$1–$2")
    .replace(/\b([bdc])\.\s*(?=\d)/gi, (_, l: string) => `${l.toLowerCase()}. `)
    .replace(/\s*[-–—]\s*$/, "–");
}
