/**
 * Values the capture app reads from a model reply or from a typed field, made
 * safe before anything stores or draws them. Pure (no imports, no path
 * aliases) so `node --test` can load it; the server routes and the browser
 * both use it.
 */

/**
 * A model reply's field as text: trimmed strings, and finite numbers as
 * written ("year": 1890 is "1890"). Anything else (null, objects, arrays,
 * booleans) is "". The routes never call string methods on raw reply values.
 */
export function text(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

/** True when nothing but white space was typed (or nothing at all). */
export function isBlank(v: unknown): boolean {
  return String(v ?? "").trim() === "";
}

/**
 * An ILIKE pattern (for a plain PostgREST filter, not inside .or()) that
 * finds `q` anywhere in a column, matching what was typed: `%`, `_` and `\`
 * are escaped, and `*`, which PostgREST turns into `%` even after a
 * backslash, becomes `_` (any one character, which includes "*").
 */
export function containsPattern(q: string): string {
  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/\*/g, "_");
  return `%${escaped}%`;
}

/** Currencies written without minor units: a decimal part is a misreading. */
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK"]);

/**
 * An amount as typed on a phone or read off an invoice, as a number; null
 * when it cannot be read without guessing.
 *
 * The decimal mark is the last "." or "," when exactly one or two digits
 * follow it ("1,250.50", "1.250,50", "1250,5"); every other separator is
 * grouping and is dropped ("1,250", "¥125,000", Indian "1,25,000"). So a
 * continental "1250,50" is 1250.50, never 125050, and "1,250" is 1250, never
 * 1.25. The mark appearing twice ("1.250.50"), a minus sign, or a decimal
 * part on a zero-decimal currency ("¥1,250.50") are refused rather than
 * guessed. Currency signs, codes, spaces and apostrophes are ignored.
 */
export function parseAmount(raw: unknown, currency?: string | null): number | null {
  const zeroDecimal = ZERO_DECIMAL.has(String(currency ?? "").trim().toUpperCase());
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) return null;
    if (zeroDecimal && !Number.isInteger(raw)) return null;
    return raw;
  }
  if (typeof raw !== "string") return null;
  // A Swiss "1'250.–" ends in a dash that means "no cents".
  const s = raw.trim().replace(/[.,]\s*[-–—]$/, "");
  if (/[-−–—]/.test(s)) return null;
  const kept = s.replace(/[^0-9.,]/g, "");
  if (!/[0-9]/.test(kept)) return null;

  let whole = kept;
  let fraction = "";
  const last = Math.max(kept.lastIndexOf("."), kept.lastIndexOf(","));
  if (last >= 0 && /^[0-9]{1,2}$/.test(kept.slice(last + 1))) {
    const mark = kept[last]!;
    const head = kept.slice(0, last);
    if (head.includes(mark)) return null;
    whole = head;
    fraction = kept.slice(last + 1);
  }
  const digits = whole.replace(/[.,]/g, "");
  if (zeroDecimal && fraction && !/^0+$/.test(fraction)) return null;
  const n = Number(`${digits || "0"}${fraction && !zeroDecimal ? `.${fraction}` : ""}`);
  return Number.isFinite(n) ? n : null;
}

/** A calendar date as yyyy-mm-dd when it is one, else null. */
export function isoDate(v: unknown): string | null {
  const s = text(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
}

export type Crop = { x: number; y: number; w: number; h: number };
export type Geo = { rotate_deg: number; crop: Crop };

/** The paper must cover at least this share of the photo each way. */
const MIN_CROP = 0.2;
/** How far past the frame a box may reach before it is taken as nonsense. */
const SLACK = 0.02;

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && /^\s*-?\d+(?:\.\d+)?\s*$/.test(v)) return Number(v);
  return null;
}

/**
 * A page's squaring geometry from the model, when it is usable: a rotation in
 * degrees (normalised to 0-360) and a paper box in fractions of the photo as
 * shown. A box in pixels or percent, one smaller than a fifth of the photo
 * either way, or one well outside the frame is refused (null), so the page
 * keeps its original photo instead of becoming a sliver. A missing box means
 * the whole frame; a missing rotation means upright.
 */
export function sanitiseGeo(v: unknown): Geo | null {
  if (!v || typeof v !== "object") return null;
  const g = v as { rotate_deg?: unknown; crop?: unknown };
  const rot = g.rotate_deg == null ? 0 : num(g.rotate_deg);
  if (rot === null) return null;
  const rotate_deg = ((rot % 360) + 360) % 360;

  if (g.crop == null) return { rotate_deg, crop: { x: 0, y: 0, w: 1, h: 1 } };
  if (typeof g.crop !== "object") return null;
  const c = g.crop as Record<string, unknown>;
  const x = num(c.x);
  const y = num(c.y);
  const w = num(c.w);
  const h = num(c.h);
  if (x === null || y === null || w === null || h === null) return null;
  if (x < 0 || y < 0 || x > 1 || y > 1) return null;
  if (x + w > 1 + SLACK || y + h > 1 + SLACK) return null;
  const crop = { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) };
  if (crop.w < MIN_CROP || crop.h < MIN_CROP) return null;
  return { rotate_deg, crop };
}

/** Smallest squared page worth keeping, in pixels, on either side. */
export const MIN_SQUARED_SIDE = 200;

export type SquarePlan = {
  /** Source rectangle in the photo's own pixels. */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Rotation to apply to that rectangle, in radians, clockwise. */
  rad: number;
  /** Size of the finished page. */
  outW: number;
  outH: number;
};

/**
 * How to square a photo of `width` × `height` pixels: crop the paper box on
 * the photo as shown, then turn that crop upright. Null when the geometry is
 * unusable, when there is nothing to do (upright and uncropped), or when the
 * result would be smaller than MIN_SQUARED_SIDE either way.
 */
export function planSquare(geo: unknown, width: number, height: number): SquarePlan | null {
  const g = sanitiseGeo(geo);
  if (!g || !(width > 0) || !(height > 0)) return null;
  const tilt = Math.min(g.rotate_deg, 360 - g.rotate_deg);
  const fullFrame = g.crop.x <= 0.01 && g.crop.y <= 0.01 && g.crop.w >= 0.98 && g.crop.h >= 0.98;
  if (tilt < 0.5 && fullFrame) return null;

  const sx = Math.round(g.crop.x * width);
  const sy = Math.round(g.crop.y * height);
  const sw = Math.min(width - sx, Math.round(g.crop.w * width));
  const sh = Math.min(height - sy, Math.round(g.crop.h * height));
  const rad = (g.rotate_deg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const outW = Math.round(sw * cos + sh * sin);
  const outH = Math.round(sw * sin + sh * cos);
  if (sw < MIN_SQUARED_SIDE || sh < MIN_SQUARED_SIDE) return null;
  if (outW < MIN_SQUARED_SIDE || outH < MIN_SQUARED_SIDE) return null;
  return { sx, sy, sw, sh, rad, outW, outH };
}
