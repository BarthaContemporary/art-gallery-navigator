/**
 * Text as a type-to-find box compares it: case and diacritics aside, so
 * "yosai" finds "Yōsai" and "SHOMIN" finds "Shōmin". Apply it to both sides.
 *
 * NFD splits a letter from its accents, the marks (\p{M}) are dropped, and
 * NFC puts back together what NFD split apart without a mark between (Hangul
 * syllables, which NFD decomposes into their letters). Kanji pass unchanged;
 * kana lose their voicing marks, so "か" also finds "が", which is the
 * forgiving side for a picker.
 *
 * Pure and import-free: client components use it, and node --test loads it.
 */
export function foldText(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC").toLowerCase();
}
