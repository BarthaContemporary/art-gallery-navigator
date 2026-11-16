/*
 * Document builders: database rows in, search documents out. Pure and
 * import-free apart from types.
 *
 * Each builder lists its output fields one by one from a row type that holds
 * only the columns load.ts selects (the *_COLUMNS lists below are those
 * selects). Nothing is spread from a row, so a column added to a table never
 * reaches the index by accident, and the mappings are dynamic "strict"
 * besides.
 *
 * The rule: nothing goes into an index that staff cannot read. Never indexed:
 * financials, purchased_from, sold_to, consignment details, the shares note,
 * source and document notes, AI suggestions; a contact's notes, address,
 * postcode, consent evidence and tokens, KYC and sanctions fields, custom
 * fields, tags, interested regions and contact type; a maker's internal notes.
 *
 * A builder returns null when the record must be removed from the index: a
 * work in the trash, an erased contact, a record that no longer exists.
 *
 * Every string loses the two highlight marker characters (so a stored value
 * can never fake a highlight) and is cut at MAX_FIELD_CHARS.
 */

export const HL_PRE = "";
export const HL_POST = "";
/** No single value needs more than this to be found; it also bounds what highlighting reads. */
export const MAX_FIELD_CHARS = 20_000;
/** Array fields (tags, provenance lines, alternative names) keep at most this many values. */
const MAX_VALUES = 200;

// ------------------------------------------------------------------ rows (exactly what load.ts selects)

/** Read from vw_pieces_all (both registers; trashed works included so they can be removed). */
export const WORK_COLUMNS = [
  "id", "stock_number", "legacy_stock_number", "title", "maker_id", "category_id", "medium", "period", "year",
  "origin_region", "description", "condition_report", "signature_inscription", "box_type", "box_notes",
  "dimensions_display", "comments", "tags", "publications", "exhibitions", "published_note", "status", "ledger",
  "web_visible", "framed", "location_id", "deleted_at",
] as const;

export type WorkRow = {
  id: string;
  stock_number: string;
  legacy_stock_number: string | null;
  title: string | null;
  maker_id: string | null;
  category_id: string | null;
  medium: string | null;
  period: string | null;
  year: string | null;
  origin_region: string | null;
  description: string | null;
  condition_report: string | null;
  signature_inscription: string | null;
  box_type: string | null;
  box_notes: string | null;
  dimensions_display: string | null;
  comments: string | null;
  tags: string[] | null;
  /** jsonb: a list of strings. */
  publications: unknown;
  /** jsonb: a list of strings. */
  exhibitions: unknown;
  published_note: string | null;
  status: string;
  ledger: string;
  web_visible: boolean | null;
  framed: boolean | null;
  location_id: string | null;
  deleted_at: string | null;
};

/** The maker fields a work's document carries (from makers). */
export const WORK_MAKER_COLUMNS = ["id", "display_name", "native_name", "romanized_name", "alt_names", "school_or_workshop"] as const;
export type WorkMakerRow = {
  id: string;
  display_name: string;
  native_name: string | null;
  romanized_name: string | null;
  alt_names: string[] | null;
  school_or_workshop: string | null;
};

export const CATEGORY_COLUMNS = ["id", "name"] as const;
export type CategoryRow = { id: string; name: string };

export const LOCATION_COLUMNS = ["id", "code", "name"] as const;
export type LocationRow = { id: string; code: string; name: string | null };

export const PROVENANCE_COLUMNS = ["piece_id", "sort_order", "date_text", "party", "details"] as const;
export type ProvenanceRow = { piece_id: string; sort_order: number | null; date_text: string | null; party: string | null; details: string | null };

/** A work's earlier stock numbers, from register moves. */
export const LEDGER_MOVE_COLUMNS = ["piece_id", "from_stock_number"] as const;
export type LedgerMoveRow = { piece_id: string; from_stock_number: string | null };

/** One work and the rows its document is built from. */
export type WorkSource = {
  work: WorkRow;
  maker: WorkMakerRow | null;
  category: CategoryRow | null;
  location: LocationRow | null;
  provenance: readonly ProvenanceRow[];
  moves: readonly LedgerMoveRow[];
};

export const MAKER_COLUMNS = [
  "id", "display_name", "native_name", "romanized_name", "alt_names", "school_or_workshop", "life_dates", "region",
  "biography", "profile_html", "web_visible",
] as const;
export type MakerRow = {
  id: string;
  display_name: string;
  native_name: string | null;
  romanized_name: string | null;
  alt_names: string[] | null;
  school_or_workshop: string | null;
  life_dates: string | null;
  region: string | null;
  biography: string | null;
  profile_html: string | null;
  web_visible: boolean | null;
};

export const CONTACT_COLUMNS = [
  "id", "first_name", "last_name", "organization_id", "email", "phone", "whatsapp_number", "city", "country", "erased_at",
] as const;
export type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  organization_id: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  city: string | null;
  country: string | null;
  erased_at: string | null;
};

export const ORGANIZATION_COLUMNS = ["id", "name"] as const;
export type OrganizationRow = { id: string; name: string };

export type ContactSource = { contact: ContactRow; organization: OrganizationRow | null };

// ------------------------------------------------------------------ documents

export type WorkDoc = {
  id: string;
  stock_number: string;
  legacy_stock_number?: string;
  retired_stock_numbers?: string[];
  title?: string;
  maker_id?: string;
  maker_name?: string;
  maker_romanized?: string;
  maker_alt_names?: string[];
  maker_native?: string;
  maker_school?: string;
  category?: string;
  category_id?: string;
  medium?: string;
  period?: string;
  year?: string;
  origin_region?: string;
  description?: string;
  condition_report?: string;
  signature_inscription?: string;
  box_notes?: string;
  dimensions_display?: string;
  comments?: string;
  publications?: string[];
  exhibitions?: string[];
  published_note?: string;
  provenance?: string[];
  tags?: string[];
  location?: string;
  location_id?: string;
  status: string;
  ledger: string;
  web_visible: boolean;
  framed: boolean;
};

export type MakerDoc = {
  id: string;
  name: string;
  name_sort: string;
  romanized_name?: string;
  alt_names?: string[];
  native_name?: string;
  school?: string;
  life_dates?: string;
  region?: string;
  biography?: string;
  web_visible: boolean;
};

export type ContactDoc = {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  organization?: string;
  email?: string;
  phones?: string[];
  city?: string;
  country?: string;
};

// ------------------------------------------------------------------ helpers

function tidy(s: string): string {
  return s.replace(/[]/g, "").slice(0, MAX_FIELD_CHARS);
}

/** A non-empty string, tidied; otherwise undefined (the field is left out). */
function text(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = tidy(v);
  return t.trim() ? t : undefined;
}

/** A list of non-empty strings, tidied; undefined when empty. Accepts a text[] column or a jsonb list. */
function list(v: unknown): string[] | undefined {
  const raw: unknown[] = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
  const out: string[] = [];
  for (const x of raw) {
    const t = text(x);
    if (t !== undefined) out.push(t);
    if (out.length >= MAX_VALUES) break;
  }
  return out.length ? out : undefined;
}

function joined(...parts: unknown[]): string | undefined {
  return text(parts.filter((p): p is string => typeof p === "string" && p.trim() !== "").join(" "));
}

const sameName = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/** Drop keys whose value is undefined, so the document holds only what was set. */
function compact<T extends Record<string, unknown>>(doc: T): T {
  for (const k of Object.keys(doc)) if (doc[k] === undefined) delete doc[k];
  return doc;
}

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };

/** Crude but safe HTML to text: drop scripts, styles and tags, decode the entities an editor emits. */
export function stripHtml(html: string | null | undefined): string | undefined {
  if (!html) return undefined;
  const t = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/g, (_, e: string) => ENTITIES[e] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
  return t ? t : undefined;
}

// ------------------------------------------------------------------ builders

export function workDoc(src: WorkSource | null | undefined): WorkDoc | null {
  if (!src) return null;
  const p = src.work;
  if (!p || p.deleted_at) return null; // the trash is never searchable
  const m = src.maker && src.maker.id === p.maker_id ? src.maker : null;
  const c = src.category && src.category.id === p.category_id ? src.category : null;
  const l = src.location && src.location.id === p.location_id ? src.location : null;
  const provenance = [...src.provenance]
    .filter((e) => e.piece_id === p.id)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((e) => joined(e.date_text, e.party, e.details));
  const retired = src.moves
    .filter((mv) => mv.piece_id === p.id)
    .map((mv) => mv.from_stock_number)
    .filter((s) => s && s !== p.stock_number && s !== p.legacy_stock_number);
  return compact<WorkDoc>({
    id: p.id,
    stock_number: tidy(p.stock_number ?? ""),
    legacy_stock_number: text(p.legacy_stock_number),
    retired_stock_numbers: list([...new Set(retired)]),
    title: text(p.title),
    maker_id: text(p.maker_id),
    maker_name: text(m?.display_name),
    maker_romanized: m && !sameName(m.romanized_name, m.display_name) ? text(m.romanized_name) : undefined,
    maker_alt_names: list(m?.alt_names),
    maker_native: text(m?.native_name),
    maker_school: text(m?.school_or_workshop),
    category: text(c?.name),
    category_id: text(p.category_id),
    medium: text(p.medium),
    period: text(p.period),
    year: text(p.year),
    origin_region: text(p.origin_region),
    description: text(p.description),
    condition_report: text(p.condition_report),
    signature_inscription: text(p.signature_inscription),
    box_notes: joined(p.box_type, p.box_notes),
    dimensions_display: text(p.dimensions_display),
    comments: text(p.comments),
    publications: list(p.publications),
    exhibitions: list(p.exhibitions),
    published_note: text(p.published_note),
    provenance: list(provenance),
    tags: list(p.tags),
    location: l ? joined(l.code, l.name) : undefined,
    location_id: text(p.location_id),
    status: String(p.status ?? ""),
    ledger: String(p.ledger ?? "jvb"),
    web_visible: p.web_visible === true,
    framed: p.framed === true,
  });
}

export function makerDoc(m: MakerRow | null | undefined): MakerDoc | null {
  if (!m) return null;
  const name = text(m.display_name) ?? "";
  return compact<MakerDoc>({
    id: m.id,
    name,
    name_sort: name,
    romanized_name: sameName(m.romanized_name, m.display_name) ? undefined : text(m.romanized_name),
    alt_names: list(m.alt_names),
    native_name: text(m.native_name),
    school: text(m.school_or_workshop),
    life_dates: text(m.life_dates),
    region: text(m.region),
    biography: joined(stripHtml(m.biography), stripHtml(m.profile_html)),
    web_visible: m.web_visible === true,
  });
}

/** Digits only: what the phone analyzer keeps anyway, so nothing else is sent. */
function digits(v: string | null | undefined): string | undefined {
  const d = (v ?? "").replace(/\D/g, "").slice(0, 32);
  return d.length >= 4 ? d : undefined;
}

export function contactDoc(src: ContactSource | null | undefined): ContactDoc | null {
  if (!src) return null;
  const c = src.contact;
  if (!c || c.erased_at) return null; // an erased contact is never indexed, pseudonymised or not
  const o = src.organization && src.organization.id === c.organization_id ? src.organization : null;
  const phones = [digits(c.phone), digits(c.whatsapp_number)].filter((x): x is string => Boolean(x));
  return compact<ContactDoc>({
    id: c.id,
    first_name: text(c.first_name),
    last_name: text(c.last_name),
    name: joined(c.first_name, c.last_name),
    organization: text(o?.name),
    email: text(c.email),
    phones: phones.length ? [...new Set(phones)] : undefined,
    city: text(c.city),
    country: text(c.country),
  });
}
