import { toText } from "./values.js";

/**
 * The legacy 'Item' column holds box / tomobako notes, e.g.
 * 'Box signed', 'fitted wood box', 'With the original wooden storage box',
 * plus junk like 'New Item', 'NO', 'yes'.
 */
export interface BoxFields {
  box_type: "signed box" | "fitted box" | "original box" | null;
  box_notes: string | null;
}

const NON_BOX_VALUES = new Set(["new item", "no", "n/a", "none", "-"]);

export function parseBox(item: unknown): BoxFields {
  const s = toText(item);
  if (!s) return { box_type: null, box_notes: null };
  const lower = s.toLowerCase();
  if (NON_BOX_VALUES.has(lower)) return { box_type: null, box_notes: null };

  let box_type: BoxFields["box_type"] = null;
  if (/signed/.test(lower)) box_type = "signed box";
  else if (/fitted/.test(lower)) box_type = "fitted box";
  else if (/original|tomobako/.test(lower)) box_type = "original box";

  return { box_type, box_notes: s };
}
