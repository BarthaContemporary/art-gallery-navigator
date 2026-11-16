/**
 * Which fields an autosave of the record editor changed, so the PATCH route
 * writes those columns only. An editor left open in a tab otherwise posts its
 * old status, location or website switch with the next typo fix, and undoes a
 * bulk change or a website switch made elsewhere in the meantime.
 *
 * The contract: the form may carry one `_changed` field, a JSON array of the
 * names whose values differ from the form as last saved (`changedKeys`
 * below). Absent, or not a list, means "write everything": the old
 * behaviour, which a keepalive flush from an old tab or any other client
 * still gets. A posted name is only ever looked up in the route's own
 * column lists here; it never becomes a column name.
 *
 * Pure (no imports), so `node --test` runs it directly.
 */

export const CHANGED_FIELD = "_changed";

/**
 * The size of the work: the six default measurements, the Framed switch and
 * the six unframed ones. Written as one group whenever any of them changed,
 * because the unframed columns follow the switch (cleared when it is off).
 */
export const DIMENSION_KEYS = [
  "height_cm",
  "width_cm",
  "depth_cm",
  "length_cm",
  "diameter_cm",
  "weight_g",
  "framed",
  "unframed_height_cm",
  "unframed_width_cm",
  "unframed_depth_cm",
  "unframed_length_cm",
  "unframed_diameter_cm",
  "unframed_weight_g",
] as const;

/**
 * The financial block (piece_financials). Written whole whenever any of it
 * changed: the purchase rate follows the cost and its £, and the sale's £ and
 * rate follow the price, currency and date.
 */
export const FINANCIAL_KEYS = [
  "purchase_date",
  "purchase_cost",
  "purchase_currency",
  "purchase_cost_gbp",
  "restoration_cost_gbp",
  "other_costs_gbp",
  "marked_price_gbp",
  "sold_date",
  "sold_price",
  "sell_currency",
  "sold_price_gbp",
  "vat_treatment",
  "buyer_contact_id",
] as const;

/** One form field that writes one column of the same name. */
const SINGLE_KEYS = [
  "title",
  "year",
  "maker_id",
  "category_id",
  "location_id",
  "status",
  "medium",
  "period",
  "origin_region",
  "description",
  "condition_report",
  "signature_inscription",
  "box_type",
  "box_notes",
  "comments",
  "source_note",
  "publications",
  "exhibitions",
  "purchased_from",
  "sold_to",
  "web_visible",
  "presentation",
  "needs_completion",
] as const;

/**
 * For each stock-table column the record editor writes, the form fields whose
 * change writes it. A column missing here (updated_by) is always written.
 */
export const PIECE_COLUMN_KEYS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  ...Object.fromEntries(SINGLE_KEYS.map((k) => [k, [k]])),
  ...Object.fromEntries(DIMENSION_KEYS.map((k) => [k, DIMENSION_KEYS])),
});

/**
 * The `_changed` field of a posted form: the set of names, or null when the
 * form did not say (absent, a file, not JSON, not a list), which means every
 * field is written.
 */
export function readChangedKeys(fd: Pick<FormData, "get" | "has">): Set<string> | null {
  if (!fd.has(CHANGED_FIELD)) return null;
  const raw = fd.get(CHANGED_FIELD);
  if (typeof raw !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  return new Set(parsed.filter((x): x is string => typeof x === "string"));
}

/** Whether a save writes any of `keys`: always when the form did not say. */
export function touches(changed: Set<string> | null, keys: readonly string[]): boolean {
  return changed == null || keys.some((k) => changed.has(k));
}

/**
 * The columns of `row` this save writes: all of them when the form did not
 * say what changed, else those whose fields changed, plus any column the map
 * does not know (updated_by), which is always written.
 */
export function onlyChanged<T extends Record<string, unknown>>(
  row: T,
  changed: Set<string> | null,
  columnKeys: Readonly<Record<string, readonly string[]>> = PIECE_COLUMN_KEYS,
): Partial<T> {
  if (changed == null) return row;
  const out: Partial<T> = {};
  for (const col of Object.keys(row) as (keyof T & string)[]) {
    const keys = Object.prototype.hasOwnProperty.call(columnKeys, col) ? columnKeys[col] : undefined;
    if (!keys || keys.some((k) => changed.has(k))) out[col] = row[col];
  }
  return out;
}

/**
 * For the autosave client: the names whose values differ between two
 * snapshots of a form, each a JSON list of [name, value] pairs in form order
 * (AutosaveForm's serialise()). Compared over the names in either snapshot,
 * because an unticked checkbox, or a field that left the form, is simply
 * absent. A name posted more than once compares as its whole list of values.
 * Null when either snapshot cannot be read: then send no `_changed` and let
 * the route write everything.
 */
export function changedKeys(before: string | null, after: string | null): string[] | null {
  const read = (s: string | null): Map<string, string[]> | null => {
    if (s == null) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(s);
    } catch {
      return null;
    }
    if (!Array.isArray(parsed)) return null;
    const out = new Map<string, string[]>();
    for (const entry of parsed) {
      if (!Array.isArray(entry) || typeof entry[0] !== "string") return null;
      const list = out.get(entry[0]) ?? [];
      list.push(String(entry[1] ?? ""));
      out.set(entry[0], list);
    }
    return out;
  };
  const a = read(before);
  const b = read(after);
  if (!a || !b) return null;
  const names = new Set([...a.keys(), ...b.keys()]);
  names.delete(CHANGED_FIELD);
  const differs = (k: string) => {
    const x = a.get(k);
    const y = b.get(k);
    if (!x || !y) return true;
    return x.length !== y.length || x.some((v, i) => v !== y[i]);
  };
  return [...names].filter(differs).sort();
}
