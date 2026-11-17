/*
 * What goes on an Avery label, and at what size, so it fits the label.
 * Pure and self-contained (no imports) so `node --test` runs it directly;
 * labels.tsx draws what this returns.
 *
 * The widths are estimates for Noto Sans (the labels' font, fonts.ts), a
 * little generous so a label the estimate passes really does fit: measured
 * means are 0.51 em a character for mixed case, 0.59 for capitals, 1 em for
 * kana and kanji. The standard-font fallback (Helvetica) is narrower still.
 */

export interface LabelAddress {
  name: string;
  organization?: string;
  lines: string[];
  city?: string;
  postcode?: string;
  country?: string;
}

const UK = /^(uk|u\.k\.?|gb|g\.b\.?|united kingdom|great britain|britain|england|scotland|wales|northern ireland)$/i;

/** True for an empty country or any usual way of writing the UK. */
export function isUkCountry(country: string | null | undefined): boolean {
  const c = (country ?? "").trim();
  return c === "" || UK.test(c);
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The lines of a postal label, top to bottom: addressee, organisation (left
 * out when it is the addressee, as for an institution with no contact
 * person), street lines, town and postcode, and the country in capitals for
 * post leaving the UK. Empty parts take no line.
 */
export function mailingLabelLines(a: LabelAddress): string[] {
  const out: string[] = [];
  const name = a.name.trim();
  if (name) out.push(name);
  const org = a.organization?.trim();
  if (org && !(name && same(org, name))) out.push(org);
  for (const l of a.lines) {
    const t = l?.trim();
    if (t) out.push(t);
  }
  const town = [a.city?.trim(), a.postcode?.trim()].filter(Boolean).join("  ");
  if (town) out.push(town);
  if (!isUkCountry(a.country)) out.push(a.country!.trim().toUpperCase());
  return out;
}

const isCjk = (cp: number) =>
  (cp >= 0x2e80 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xff00 && cp <= 0xff60) || cp >= 0x20000;

/**
 * A word may be broken only when it cannot fit a line of the narrowest
 * label (L7160) even at the smallest size: over 30 characters, or over 12
 * kana/kanji (written without spaces, so a whole Japanese address line is
 * one "word" here). Shorter words always wrap whole; fitLabel picks a size at
 * which they fit.
 */
function breakable(word: string): boolean {
  const chars = Array.from(word);
  return chars.length > 30 || (chars.length > 12 && chars.some((c) => isCjk(c.codePointAt(0) ?? 0)));
}

/**
 * Hyphenation for label text (a Text's hyphenationCallback): words wrap
 * whole, never "Ar-chaeology". Only a word too long for any label line is
 * given break points, so it wraps instead of running off the label's edge.
 */
export function labelHyphenation(word: string): string[] {
  if (!breakable(word)) return [word];
  const chars = Array.from(word);
  const parts: string[] = [];
  for (let i = 0; i < chars.length; i += 6) parts.push(chars.slice(i, i + 6).join(""));
  return parts;
}

// ---------------------------------------------------------------------------
// Fitting
// ---------------------------------------------------------------------------

/** Estimated advance of one character, in em. */
function charEm(ch: string, bold: boolean): number {
  const cp = ch.codePointAt(0) ?? 0;
  let w: number;
  if (isCjk(cp)) {
    w = 1; // kana, kanji, CJK punctuation, full-width forms
  } else if (ch === " ") {
    w = 0.26;
  } else if (/[ilIj.,:;'|!()\-[\]]/.test(ch)) {
    w = 0.3;
  } else if (/[A-Z0-9MWmw@%&]/.test(ch) || ch !== ch.toLowerCase()) {
    w = 0.64;
  } else {
    w = 0.55;
  }
  return bold ? w * 1.06 : w;
}

export function textWidthEm(text: string, bold = false): number {
  let w = 0;
  for (const ch of text) w += charEm(ch, bold);
  return w;
}

/**
 * Lines the text wraps to at this size in this width: greedy word wrap
 * (labels never hyphenate), a word longer than the line broken across lines
 * when labelHyphenation breaks it. Infinity when a word it keeps whole is
 * wider than the line: at this size it would run off the label.
 */
export function estimateLines(text: string, fontSize: number, width: number, bold = false): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const space = textWidthEm(" ") * fontSize;
  let lines = 1;
  let used = 0;
  for (const word of words) {
    const w = textWidthEm(word, bold) * fontSize;
    if (w > width && !breakable(word)) return Infinity;
    if (used === 0) {
      if (w <= width) used = w;
      else {
        lines += Math.ceil(w / width) - 1;
        used = w % width || width;
      }
    } else if (used + space + w <= width) {
      used += space + w;
    } else {
      lines += 1;
      if (w <= width) used = w;
      else {
        lines += Math.ceil(w / width) - 1;
        used = w % width || width;
      }
    }
  }
  return lines;
}

export interface LabelText {
  text: string;
  /** Size relative to the label's base size (the stock and size lines are smaller). */
  scale?: number;
  bold?: boolean;
  /** At most this many lines; the rest ends in an ellipsis. */
  maxLines?: number;
}

export interface LabelFit {
  /** Base font size in points; each text is drawn at fontSize × its scale. */
  fontSize: number;
  /** Leading as a multiple of each text's own size (draw as points: size × this). */
  leading: number;
  /** Per text, the most lines it may take (the rest ends in an ellipsis). */
  maxLines: number[];
  /** False only when there are more texts than lines: draw top-aligned so the first ones survive. */
  fits: boolean;
}

/** Base sizes tried, largest first. 9.5 pt is the labels' normal size. */
export const LABEL_SIZES = [9.5, 9, 8.5, 8, 7.5, 7] as const;
const MIN_LABEL_SIZE = 7;
export const LABEL_LEADING = 1.3;

/**
 * The largest size at which every text fits the label's content box
 * (points). When none does, the smallest size, with the texts that wrap the
 * most cut to fewer lines (never the first, the addressee or stock number,
 * while another can give) until it fits. A label must fit: when text runs
 * past the box react-pdf lays the lines over each other.
 */
export function fitLabel(texts: LabelText[], box: { width: number; height: number }): LabelFit {
  const linesAt = (size: number, i: number) => {
    const t = texts[i]!;
    return estimateLines(t.text, size * (t.scale ?? 1), box.width, t.bold);
  };
  // Infinity (a word wider than the line at this size) fails the size.
  const heightAt = (size: number, caps: number[]) =>
    texts.reduce((h, t, i) => h + Math.min(linesAt(size, i), caps[i]!) * size * (t.scale ?? 1) * LABEL_LEADING, 0);
  const caps = texts.map((t) => Math.max(1, t.maxLines ?? 99));
  for (const size of LABEL_SIZES) {
    if (texts.every((_, i) => Number.isFinite(linesAt(size, i))) && heightAt(size, caps) <= box.height) {
      return { fontSize: size, leading: LABEL_LEADING, maxLines: caps, fits: true };
    }
  }
  const size = MIN_LABEL_SIZE;
  const lines = texts.map((_, i) => Math.min(linesAt(size, i), caps[i]!));
  while (heightAt(size, lines) > box.height) {
    // The text with the most lines gives one up (on a tie the later one);
    // the first only when no other can.
    let pick = -1;
    for (let i = lines.length - 1; i >= 1; i--) {
      if (lines[i]! > 1 && (pick < 0 || lines[i]! > lines[pick]!)) pick = i;
    }
    if (pick < 0 && lines.length > 0 && lines[0]! > 1) pick = 0;
    if (pick < 0) return { fontSize: size, leading: LABEL_LEADING, maxLines: lines, fits: false };
    lines[pick] = lines[pick]! - 1;
  }
  return { fontSize: size, leading: LABEL_LEADING, maxLines: lines, fits: true };
}
