/**
 * Maker-name extraction from free text. These are PROPOSALS only —
 * the dealer confirms before any makers rows are created (see finalize
 * --accept-makers). Typical source text (first line of Description):
 *   'Yoneda Bishō (1929-2008)\nHeight: 15.5 cm, ...'
 *   'Kano Natsuo (b. 1828)'
 */

export interface MakerProposal {
  proposed_maker: string;
  life_dates: string;
  source: "description" | "title";
  matched_text: string;
}

const LIFE_DATES_RE =
  /^(.{2,60}?)\s*\(\s*(?:c\.?\s*)?(\d{4})\s*[-–—]\s*(\d{4})\s*\)/;
const BORN_RE = /^(.{2,60}?)\s*\(\s*(?:b\.?|born)\s*(\d{4})\s*\)/i;
const ACTIVE_RE = /^(.{2,60}?)\s*\(\s*(?:active|fl\.?)\s*([^)]{4,30})\)/i;

function plausibleName(name: string): boolean {
  const n = name.trim();
  if (n.length < 2 || n.length > 60) return false;
  if (/\d/.test(n)) return false;
  if (!/\p{L}/u.test(n)) return false;
  // Reject fragments that are clearly not names.
  if (/^(the|a|an|with|height|width|depth|signed|japan|india)\b/i.test(n)) return false;
  return true;
}

function fromLine(
  line: string,
  source: "description" | "title",
): MakerProposal | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let m = trimmed.match(LIFE_DATES_RE);
  if (m && plausibleName(m[1]!)) {
    return {
      proposed_maker: m[1]!.trim().replace(/[,;]+$/, ""),
      life_dates: `${m[2]}–${m[3]}`,
      source,
      matched_text: m[0],
    };
  }
  m = trimmed.match(BORN_RE);
  if (m && plausibleName(m[1]!)) {
    return {
      proposed_maker: m[1]!.trim().replace(/[,;]+$/, ""),
      life_dates: `b. ${m[2]}`,
      source,
      matched_text: m[0],
    };
  }
  m = trimmed.match(ACTIVE_RE);
  if (m && plausibleName(m[1]!)) {
    return {
      proposed_maker: m[1]!.trim().replace(/[,;]+$/, ""),
      life_dates: `active ${m[2]!.trim()}`,
      source,
      matched_text: m[0],
    };
  }
  return null;
}

/** Try the first line of Description, then Title. */
export function extractMaker(
  description: string | null,
  title: string | null,
): MakerProposal | null {
  if (description) {
    const firstLine = description.split(/\r?\n/, 1)[0] ?? "";
    const hit = fromLine(firstLine, "description");
    if (hit) return hit;
  }
  if (title) {
    const hit = fromLine(title.split(/\r?\n/, 1)[0] ?? "", "title");
    if (hit) return hit;
  }
  return null;
}

/** Normalization key for deduplicating makers (case/space/diacritic-insensitive). */
export function normalizeMakerName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
