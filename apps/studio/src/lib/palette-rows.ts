/*
 * The ⌘K palette's rows, from the pages it may go to and /api/search's
 * answer: pure, so the client component stays thin and node --test can
 * check the order, the labels and the links.
 *
 * Order: pages whose label holds the query, then Works, Makers, Contacts and
 * Records. Works end with "All works matching …" (the inventory search) and
 * Contacts with "All contacts matching …" (the contacts page): those rows
 * come only with results, or when that group's search failed (the full page
 * is the way to try again), so the contacts row never shows for a role the
 * contacts were not searched for.
 */
import type { PaletteGroup, PaletteResponse } from "./palette-search";
import { STATUS_LABELS } from "./labels";

export type RowGroup = "page" | "piece" | "maker" | "contact" | "record";

export type PaletteRow = {
  group: RowGroup;
  /** Stable within one list: the React key. */
  key: string;
  href: string;
  label: string;
  sub?: string;
  /** A small third line: the field a work matched in, when the row does not show it. */
  note?: string;
  /** "All works matching …": a link to the full search, not a result. */
  more?: boolean;
};

export const GROUP_HEADINGS: Record<RowGroup, string> = {
  page: "Pages",
  piece: "Works",
  maker: "Makers",
  contact: "Contacts",
  record: "Records",
};

/** A link from the answer is followed only when it is a path on this site. */
function sitePath(href: string): string | null {
  return href.startsWith("/") && !href.startsWith("//") && !href.includes("\\") ? href : null;
}

/** The query as a link parameter and as a label (quoted, cut when long). */
function shown(q: string): string {
  const chars = [...q];
  return chars.length > 40 ? `${chars.slice(0, 39).join("")}…` : q;
}

export function paletteRows(
  navItems: readonly { href: string; label: string }[],
  rawQuery: string,
  answer: PaletteResponse | null,
): PaletteRow[] {
  const q = rawQuery.trim();
  const lower = q.toLowerCase();
  const rows: PaletteRow[] = navItems
    .filter((n) => !lower || n.label.toLowerCase().includes(lower))
    .map((n) => ({ group: "page", key: `page:${n.href}`, href: n.href, label: n.label, sub: "Go to" }));
  if (!answer || !q) return rows;
  const failed = new Set(answer.failed);

  for (const p of answer.pieces) {
    rows.push({
      group: "piece",
      key: `piece:${p.id}`,
      href: `/inventory/${encodeURIComponent(p.stock_number)}`,
      label: p.title?.trim() ? p.title : p.stock_number,
      sub: [p.stock_number, p.maker_name, p.status ? STATUS_LABELS[p.status] ?? p.status : null].filter(Boolean).join(" · "),
      note: p.matched ? `Matched in ${p.matched}` : undefined,
    });
  }
  if (answer.pieces.length > 0 || failed.has("pieces")) {
    rows.push({
      group: "piece",
      key: "more:pieces",
      href: `/inventory?q=${encodeURIComponent(q)}`,
      label: `All works matching “${shown(q)}”`,
      sub: "Inventory search",
      more: true,
    });
  }

  for (const m of answer.makers) {
    rows.push({ group: "maker", key: `maker:${m.id}`, href: `/makers/${m.id}`, label: m.name, sub: m.detail ?? "Maker" });
  }

  for (const c of answer.contacts) {
    rows.push({ group: "contact", key: `contact:${c.id}`, href: `/crm/contacts/${c.id}`, label: c.name, sub: c.email ?? "Contact" });
  }
  if (answer.contacts.length > 0 || failed.has("contacts")) {
    rows.push({
      group: "contact",
      key: "more:contacts",
      href: `/crm/contacts?q=${encodeURIComponent(q)}`,
      label: `All contacts matching “${shown(q)}”`,
      sub: "Contacts search",
      more: true,
    });
  }

  for (const r of answer.records) {
    const href = sitePath(r.href);
    if (href) rows.push({ group: "record", key: `record:${r.type}:${r.id}`, href, label: r.title, sub: r.detail });
  }
  return rows;
}

/** Whether a group's rows are the typo-tolerant pass's: its heading says "Similar matches". */
export function isSimilar(group: RowGroup, answer: PaletteResponse | null): boolean {
  if (!answer) return false;
  if (group === "piece") return answer.similar.pieces;
  if (group === "maker") return answer.similar.makers;
  if (group === "contact") return answer.similar.contacts;
  return false;
}

const WORDS: Record<PaletteGroup, string> = { pieces: "works", makers: "makers", contacts: "contacts", records: "records" };

/** "works and contacts", "works, makers and records". */
function list(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** The line that says which searches failed, or null when none did. */
export function failedText(failed: readonly PaletteGroup[]): string | null {
  if (failed.length === 0) return null;
  return `Couldn’t search ${list(failed.map((g) => WORDS[g]))}. Try again in a moment.`;
}
